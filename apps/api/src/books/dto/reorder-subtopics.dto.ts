import { IsArray, IsInt, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class SubtopicOrderEntry {
  @IsString()
  id: string;

  @IsInt()
  orderIndex: number;
}

export class ReorderSubtopicsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SubtopicOrderEntry)
  subtopics: SubtopicOrderEntry[];
}
