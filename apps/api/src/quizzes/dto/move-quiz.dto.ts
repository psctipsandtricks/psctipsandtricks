import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class MoveQuizDto {
  @ApiProperty({
    description:
      'Zero-based position within the quiz’s folder. Clamped server-side, so an out-of-range value lands at the nearest end rather than failing.',
    example: 0,
  })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  position: number;
}
