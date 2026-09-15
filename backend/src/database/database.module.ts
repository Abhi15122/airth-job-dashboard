import { Injectable, Logger, Module, OnApplicationShutdown } from '@nestjs/common';
import { Pool } from 'pg';

@Injectable()
export class Database implements OnApplicationShutdown {
  readonly pool: Pool;
  private readonly logger = new Logger(Database.name);

  constructor() {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) throw new Error('Set DATABASE_URL in backend/.env before starting the API.');
    this.pool = new Pool({ connectionString, max: 5, connectionTimeoutMillis: 10000, idleTimeoutMillis: 30000, statement_timeout: 10000 });
    this.pool.on('error', () => this.logger.error('An idle database connection failed.'));
  }

  async onApplicationShutdown() {
    await this.pool.end();
  }
}

@Module({ providers: [Database], exports: [Database] })
export class DatabaseModule {}
