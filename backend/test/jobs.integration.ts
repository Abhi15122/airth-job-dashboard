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
    if (url === process.env.DATABASE_URL) throw new Error('TEST_DATABASE_URL must differ from DATABASE_URL.');
    admin = new Pool({ connectionString: url, max: 1, connectionTimeoutMillis: 5000 });
    await admin.query(`CREATE SCHEMA "${schema}"`);
    pool = new Pool({ connectionString: url, max: 2, connectionTimeoutMillis: 5000, options: `-c search_path=${schema}` });
    await pool.query(readFileSync(join(__dirname, '../migrations/001_create_jobs.sql'), 'utf8'));
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(Database).useValue({ pool }).compile();
    app = module.createNestApplication();
    configureApp(app);
    await app.init();
  });

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
});
