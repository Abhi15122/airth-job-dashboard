import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { CreateJobDto } from './dto/create-job.dto';
import { UpdateStatusDto } from './dto/update-status.dto';
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

  @Patch(':id/status')
  updateStatus(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string, @Body() input: UpdateStatusDto) {
    return this.jobsService.updateStatus(id, input.status);
  }

  @Delete(':id')
  @HttpCode(204)
  delete(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    return this.jobsService.delete(id);
  }
}
