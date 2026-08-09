import { IsArray, IsInt, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class ChapterOrderEntry {
  @IsString()
  id: string;

  @IsInt()
  orderIndex: number;
}

export class ReorderChaptersDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ChapterOrderEntry)
  chapters: ChapterOrderEntry[];
}
