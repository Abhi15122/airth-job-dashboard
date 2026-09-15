import { Module } from '@nestjs/common';
import { JobsModule } from './jobs/jobs.module';
import { DatabaseModule } from './database/database.module';
import { HealthController } from './health.controller';

@Module({ imports: [DatabaseModule, JobsModule], controllers: [HealthController] })
export class AppModule {}
