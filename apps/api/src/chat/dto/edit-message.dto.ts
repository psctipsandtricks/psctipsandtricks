import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsObject, IsOptional, IsString, MaxLength } from 'class-validator';

export class EditMessageDto {
  @ApiPropertyOptional({ description: 'The rewritten message text.' })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  content?: string;

  @ApiPropertyOptional({
    description:
      "A poll's rewritten question and options. Votes on options kept by id survive the edit.",
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}
