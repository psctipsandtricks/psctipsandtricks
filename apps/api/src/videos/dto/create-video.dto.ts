import { IsBoolean, IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';

export class CreateVideoDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  /**
   * Any YouTube link shape. The service parses it into the id / canonical URL
   * / thumbnail triple — the client never supplies a thumbnail, so a video can
   * never be listed under an image that isn't its own.
   */
  @IsString()
  @IsNotEmpty()
  youtubeUrl: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  orderIndex?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsString()
  pdfUrl?: string;

  @IsOptional()
  @IsString()
  pdfFileName?: string;

  @IsOptional()
  @IsInt()
  pdfSizeBytes?: number;
}
