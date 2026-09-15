import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { Database } from './database/database.module';

@Controller('health')
export class HealthController {
  constructor(private readonly database: Database) {}

  @Get()
  async check() {
    try {
      await this.database.pool.query('SELECT 1');
      return { status: 'ok', database: 'up' };
    } catch {
      throw new ServiceUnavailableException('Database is unavailable.');
    }
  }
}
