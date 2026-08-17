import { IsBoolean, IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';

/**
 * The file itself is not part of this body — it arrives on the separate
 * multipart upload endpoint, so a document can be renamed or reordered without
 * re-sending its PDF.
 */
export class CreatePdfDocumentDto {
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

export class UpdatePdfDocumentDto {
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
