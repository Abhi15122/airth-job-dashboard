import { IsIn } from 'class-validator';
import { JobStatus } from '../job';

export class UpdateStatusDto {
  @IsIn(['pending', 'running', 'completed', 'failed'])
  status!: JobStatus;
}
