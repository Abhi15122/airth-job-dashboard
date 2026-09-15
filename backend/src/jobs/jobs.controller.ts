import { Body, Controller, Get, Post } from '@nestjs/common';
import { CreateJobDto } from './dto/create-job.dto';
import { JobsService } from './jobs.service';

@Controller('jobs')
export class JobsController {
  constructor(private readonly jobsService: JobsService) {}

  @Post()
  create(@Body() input: CreateJobDto) {
    return this.jobsService.create(input);
  }

  @Get()
  list() {
    return this.jobsService.list();
  }
}
