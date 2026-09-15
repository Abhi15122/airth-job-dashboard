import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Database } from '../database/database.module';
import { CreateJobDto } from './dto/create-job.dto';
import { Job } from './job';

type JobRow = Omit<Job, 'createdAt'> & { createdAt: Date };
const columns = 'id, title, type, status, created_at AS "createdAt"';
const serialize = (row: JobRow): Job => ({ ...row, createdAt: row.createdAt.toISOString() });

@Injectable()
export class JobsService {
  constructor(private readonly database: Database) {}

  async create(input: CreateJobDto): Promise<Job> {
    const result = await this.database.pool.query<JobRow>(
      `INSERT INTO jobs (id, title, type) VALUES ($1, $2, $3) RETURNING ${columns}`,
      [randomUUID(), input.title, input.type],
    );
    return serialize(result.rows[0]);
  }

  async list(): Promise<Job[]> {
    const result = await this.database.pool.query<JobRow>(
      `SELECT ${columns} FROM jobs ORDER BY created_at DESC, id DESC`,
    );
    return result.rows.map(serialize);
  }
}
