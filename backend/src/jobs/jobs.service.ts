import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Database } from '../database/database.module';
import { CreateJobDto } from './dto/create-job.dto';
import { Job, JobStatus } from './job';

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

  async updateStatus(id: string, status: JobStatus): Promise<Job> {
    const result = await this.database.pool.query<JobRow>(
      `UPDATE jobs SET status = $2 WHERE id = $1 AND (
        (status = 'pending' AND $2 = 'running') OR
        (status = 'running' AND $2 IN ('completed', 'failed'))
      ) RETURNING ${columns}`, [id, status],
    );
    if (result.rows[0]) return serialize(result.rows[0]);
    const existing = await this.database.pool.query('SELECT id FROM jobs WHERE id = $1', [id]);
    if (!existing.rowCount) throw new NotFoundException('Job not found.');
    throw new ConflictException('Invalid status transition. Refresh the list; another request may have changed this job.');
  }

  async delete(id: string): Promise<void> {
    const result = await this.database.pool.query('DELETE FROM jobs WHERE id = $1', [id]);
    if (!result.rowCount) throw new NotFoundException('Job not found.');
  }
}
