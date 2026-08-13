import { IsArray, IsInt, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class TopicOrderEntry {
  @IsString()
  id: string;

  @IsInt()
  orderIndex: number;
}

export class ReorderTopicsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TopicOrderEntry)
  topics: TopicOrderEntry[];
}
