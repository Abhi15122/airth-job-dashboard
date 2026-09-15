import { Transform } from 'class-transformer';
import { IsString, Length } from 'class-validator';

// Only strings are trimmed. Numbers and null must remain invalid input.
const trimString = ({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value;

export class CreateJobDto {
  @Transform(trimString)
  @IsString()
  @Length(1, 120)
  title!: string;

  @Transform(trimString)
  @IsString()
  @Length(1, 50)
  type!: string;
}
