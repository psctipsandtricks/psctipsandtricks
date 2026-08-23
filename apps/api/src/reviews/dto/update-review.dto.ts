import { IsBoolean, IsInt, IsOptional, IsString, Length, Max, Min } from 'class-validator';

export class UpdateReviewDto {
  @IsOptional()
  @IsString()
  @Length(2, 60, { message: 'Customer name must be between 2 and 60 characters' })
  customerName?: string;

  @IsOptional()
  @IsInt({ message: 'Rating must be a whole number of stars' })
  @Min(1, { message: 'Rating must be at least 1 star' })
  @Max(5, { message: 'Rating cannot exceed 5 stars' })
  rating?: number;

  @IsOptional()
  @IsString()
  @Length(10, 600, { message: 'Review must be between 10 and 600 characters' })
  comment?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  orderIndex?: number;
}
