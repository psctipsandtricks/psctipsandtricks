import { ApiProperty } from '@nestjs/swagger';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsString } from 'class-validator';

export class ErasePdfHighlightsDto {
  @ApiProperty({
    description:
      'Ids to remove. A batch because one swipe of the eraser can cross several strokes.',
    type: [String],
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(500)
  @IsString({ each: true })
  ids!: string[];
}
