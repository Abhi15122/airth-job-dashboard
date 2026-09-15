import 'reflect-metadata';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Pool } from 'pg';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/configure-app';
import { Database } from '../src/database/database.module';

describe('Create/list against isolated PostgreSQL', () => {
  let app: INestApplication | undefined;
  let admin: Pool | undefined;
  let pool: Pool | undefined;
  const schema = `airth_test_${randomUUID().replaceAll('-', '')}`;

  beforeAll(async () => {
    const url = process.env.TEST_DATABASE_URL;
    if (!url) throw new Error('Set TEST_DATABASE_URL to a dedicated test database. This suite does not silently skip.');
    const testUrl = new URL(url);
    if (process.env.DATABASE_URL) {
      const appUrl = new URL(process.env.DATABASE_URL);
      if (testUrl.hostname.replace('-pooler', '') === appUrl.hostname.replace('-pooler', '') && testUrl.pathname === appUrl.pathname) {
        throw new Error('TEST_DATABASE_URL must identify a separate database or branch.');
      }
    }
    // Session search_path needs a direct connection, not transaction pooling.
    if (testUrl.hostname.endsWith('.neon.tech')) testUrl.hostname = testUrl.hostname.replace('-pooler', '');
    testUrl.searchParams.delete('options');
    const connectionString = testUrl.toString();
    admin = new Pool({ connectionString, max: 1, connectionTimeoutMillis: 10000 });
    await admin.query(`CREATE SCHEMA "${schema}"`);
    pool = new Pool({ connectionString, max: 5, connectionTimeoutMillis: 10000, options: `-c search_path=${schema}` });
    const current = await pool.query('SELECT current_schema() AS schema');
    if (current.rows[0].schema !== schema) throw new Error('Test schema isolation failed.');
    await pool.query(readFileSync(join(__dirname, '../migrations/001_create_jobs.sql'), 'utf8'));
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(Database).useValue({ pool }).compile();
    app = module.createNestApplication();
    configureApp(app);
    await app.init();
  });

  beforeEach(async () => { await pool!.query('TRUNCATE jobs'); });

  afterAll(async () => {
    await app?.close();
    await pool?.end();
    if (admin) {
      try { await admin.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`); }
      finally { await admin.end(); }
    }
  });

  it('persists a pending job and returns it from the list', async () => {
    const created = await request(app!.getHttpServer()).post('/jobs').send({ title: 'Sales report', type: 'report' }).expect(201);
    const listed = await request(app!.getHttpServer()).get('/jobs').expect(200);
    expect(listed.body).toContainEqual(created.body);
    expect(created.body.status).toBe('pending');
    const stored = await pool!.query('SELECT status FROM jobs WHERE id = $1', [created.body.id]);
    expect(stored.rows[0].status).toBe('pending');
  });

  it('enforces status and nonblank constraints in PostgreSQL', async () => {
    await expect(pool!.query('INSERT INTO jobs (id,title,type,status) VALUES ($1,$2,$3,$4)', [randomUUID(), 'Valid', 'report', 'invalid'])).rejects.toMatchObject({ code: '23514' });
    await expect(pool!.query('INSERT INTO jobs (id,title,type) VALUES ($1,$2,$3)', [randomUUID(), '   ', 'report'])).rejects.toMatchObject({ code: '23514' });
  });

  const create = async () => (await request(app!.getHttpServer()).post('/jobs').send({ title: 'Integration job', type: 'report' }).expect(201)).body;
  const patch = (id: string, status: string) => request(app!.getHttpServer()).patch(`/jobs/${id}/status`).send({ status });

  it.each(['completed', 'failed'])('supports the full lifecycle ending in %s and deletion', async terminal => {
    const job = await create();
    await patch(job.id, 'running').expect(200);
    await patch(job.id, terminal).expect(200);
    await patch(job.id, 'running').expect(409);
    await request(app!.getHttpServer()).delete(`/jobs/${job.id}`).expect(204).expect('');
    await request(app!.getHttpServer()).delete(`/jobs/${job.id}`).expect(404);
    expect((await request(app!.getHttpServer()).get('/jobs')).body).toEqual([]);
  });

  it.each(['pending', 'running', 'completed', 'failed'])('enforces every transition from %s', async initial => {
    for (const target of ['pending', 'running', 'completed', 'failed']) {
      const job = await create();
      await pool!.query('UPDATE jobs SET status = $2 WHERE id = $1', [job.id, initial]);
      const allowed = (initial === 'pending' && target === 'running') || (initial === 'running' && ['completed', 'failed'].includes(target));
      await patch(job.id, target).expect(allowed ? 200 : 409);
      const stored = await pool!.query('SELECT status FROM jobs WHERE id = $1', [job.id]);
      expect(stored.rows[0].status).toBe(allowed ? target : initial);
    }
  });

  it('allows exactly one of eight simultaneous starts', async () => {
    const job = await create();
    const responses = await Promise.all(Array.from({ length: 8 }, () => patch(job.id, 'running')));
    expect(responses.filter(response => response.status === 200)).toHaveLength(1);
    expect(responses.filter(response => response.status === 409)).toHaveLength(7);
    expect((await pool!.query('SELECT status FROM jobs WHERE id = $1', [job.id])).rows[0].status).toBe('running');
  });

  it('allows exactly one competing terminal transition', async () => {
    const job = await create();
    await patch(job.id, 'running').expect(200);
    const responses = await Promise.all([patch(job.id, 'completed'), patch(job.id, 'failed')]);
    expect(responses.map(response => response.status).sort()).toEqual([200, 409]);
    const winner = responses.find(response => response.status === 200)!;
    expect((await pool!.query('SELECT status FROM jobs WHERE id = $1', [job.id])).rows[0].status).toBe(winner.body.status);
  });

  it('handles simultaneous deletion deterministically', async () => {
    const job = await create();
    const responses = await Promise.all([request(app!.getHttpServer()).delete(`/jobs/${job.id}`), request(app!.getHttpServer()).delete(`/jobs/${job.id}`)]);
    expect(responses.map(response => response.status).sort()).toEqual([204, 404]);
  });

  it('returns 404 for a missing UUID and 400 for invalid IDs or status bodies', async () => {
    await patch(randomUUID(), 'running').expect(404);
    await patch('bad-id', 'running').expect(400);
    await request(app!.getHttpServer()).delete('/jobs/bad-id').expect(400);
    const job = await create();
    for (const body of [{}, { status: null }, { status: 2 }, { status: 'unknown' }, { status: 'running', title: 'forged' }]) {
      await request(app!.getHttpServer()).patch(`/jobs/${job.id}/status`).send(body).expect(400);
    }
  });

  it('accepts duplicate titles and treats SQL-looking input as plain data', async () => {
    await create(); await create();
    const title = "Robert'); DROP TABLE jobs;--";
    await request(app!.getHttpServer()).post('/jobs').send({ title, type: 'report' }).expect(201);
    const rows = (await request(app!.getHttpServer()).get('/jobs')).body;
    expect(rows).toHaveLength(3);
    expect(rows[0].title).toBe(title);
  });

  it('reports database readiness', async () => {
    await request(app!.getHttpServer()).get('/health').expect(200).expect({ status: 'ok', database: 'up' });
  });
});
