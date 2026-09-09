import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreatePdfHighlightDto {
  @ApiProperty({ description: 'The document being marked, by its URL.' })
  @IsString()
  @MaxLength(2000)
  documentKey!: string;

  @ApiProperty({ description: 'Zero-based page index.' })
  @IsInt()
  @Min(0)
  @Max(100000)
  page!: number;

  @ApiProperty({
    description:
      'Stroke path as flat [x0, y0, x1, y1, …] fractions of the page box.',
    type: [Number],
  })
  @IsArray()
  // Two numbers is a dot; the cap stops one runaway gesture writing a
  // multi-megabyte row. Clients thin their strokes well below this.
  @ArrayMinSize(2)
  @ArrayMaxSize(4000)
  @IsNumber({}, { each: true })
  points!: number[];

  @ApiPropertyOptional({ description: 'ARGB colour as an integer.' })
  @IsOptional()
  @IsInt()
  color?: number;

  @ApiPropertyOptional({ description: 'Nib width as a fraction of page width.' })
  @IsOptional()
  @IsNumber()
  @Min(0.001)
  @Max(1)
  width?: number;
}
