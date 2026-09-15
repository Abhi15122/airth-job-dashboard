import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { JobsController } from './jobs.controller';
import { JobsService } from './jobs.service';

@Module({ imports: [DatabaseModule], controllers: [JobsController], providers: [JobsService] })
export class JobsModule {}
