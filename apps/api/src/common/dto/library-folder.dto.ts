import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

/**
 * Both content libraries (videos and PDFs) are browsed through the same
 * Exam → Chapter folder tree, and a folder carries the same fields at either
 * level. One pair of DTOs therefore covers all eight create/update surfaces.
 * This is shape reuse only — the two modules remain otherwise independent,
 * with their own tables, routes, and permissions.
 */
export class CreateLibraryFolderDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  orderIndex?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateLibraryFolderDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  orderIndex?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class ReorderEntryDto {
  @IsString()
  @IsNotEmpty()
  id: string;

  @IsInt()
  @Min(0)
  orderIndex: number;
}

export class ReorderDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReorderEntryDto)
  items: ReorderEntryDto[];
}
