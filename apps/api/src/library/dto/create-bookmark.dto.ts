import { IsEnum, IsString } from 'class-validator';
import { BookmarkType } from '@prisma/client';

export class CreateBookmarkDto {
  @IsEnum(BookmarkType)
  referenceType: BookmarkType;

  @IsString()
  referenceId: string;
}
