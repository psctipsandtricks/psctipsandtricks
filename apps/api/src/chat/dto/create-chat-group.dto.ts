import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateChatGroupDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  type?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  iconEmoji?: string;

  @IsOptional()
  @IsString()
  imageUrl?: string;

  @IsOptional()
  @IsString()
  coverGradient?: string;

  @IsOptional()
  @IsBoolean()
  isLocked?: boolean;

  /**
   * Terms a student must accept before joining. Blank means no gate, which is
   * how a group behaves unless an admin writes one.
   */
  @IsOptional()
  @IsString()
  @MaxLength(10000)
  agreement?: string;
}
