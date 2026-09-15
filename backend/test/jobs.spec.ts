import 'reflect-metadata';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/configure-app';
import { Database } from '../src/database/database.module';

describe('Create/list HTTP contract (mock database)', () => {
  let app: INestApplication;
  const query = jest.fn();
  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(Database).useValue({ pool: { query } }).compile();
    app = module.createNestApplication();
    configureApp(app);
    await app.init();
  });
  beforeEach(() => query.mockReset());
  afterAll(async () => { await app.close(); });

  it('trims inputs and returns a server-created pending job', async () => {
    query.mockImplementation(async (_sql: string, values: string[]) => ({ rows: [{
      id: values[0], title: values[1], type: values[2], status: 'pending', createdAt: new Date('2026-09-15T10:00:00Z'),
    }] }));
    const response = await request(app.getHttpServer()).post('/jobs').send({ title: '  Sales report  ', type: '  report  ' }).expect(201);
    expect(response.body).toEqual({ id: expect.any(String), title: 'Sales report', type: 'report', status: 'pending', createdAt: '2026-09-15T10:00:00.000Z' });
    expect(query.mock.calls[0][1]).toEqual([expect.stringMatching(/^[0-9a-f-]{36}$/), 'Sales report', 'report']);
  });

  it.each([
    {}, { title: '', type: 'report' }, { title: ' \t\n ', type: 'report' },
    { title: null, type: 'report' }, { title: 123, type: 'report' },
    { title: [], type: 'report' }, { title: 'x'.repeat(121), type: 'report' },
    { title: 'Valid', type: 'x'.repeat(51) }, { title: 'Valid', type: false },
    { title: 'Valid', type: '  ' }, { title: 'Valid' },
    ...['status', 'id', 'createdAt', 'unexpected'].map(key => ({ title: 'Valid', type: 'report', [key]: 'forged' })),
  ])('rejects invalid create input %# before querying the database', async body => {
    await request(app.getHttpServer()).post('/jobs').send(body).expect(400);
    expect(query).not.toHaveBeenCalled();
  });

  it('returns an empty array when no jobs exist', async () => {
    query.mockResolvedValue({ rows: [] });
    const response = await request(app.getHttpServer()).get('/jobs').expect(200);
    expect(response.body).toEqual([]);
  });

  it('keeps SQL-looking titles in query parameters', async () => {
    const title = "Robert'); DROP TABLE jobs;--";
    query.mockImplementation(async (_sql: string, values: string[]) => ({ rows: [{
      id: values[0], title, type: 'report', status: 'pending', createdAt: new Date(),
    }] }));
    await request(app.getHttpServer()).post('/jobs').send({ title, type: 'report' }).expect(201);
    expect(query.mock.calls[0][0]).not.toContain(title);
    expect(query.mock.calls[0][1][1]).toBe(title);
  });
});
