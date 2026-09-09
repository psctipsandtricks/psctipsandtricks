import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';

export class JoinGroupDto {
  @ApiPropertyOptional({
    description:
      "Set once the student has read and accepted the group's agreement. Required for any group that has one.",
  })
  @IsOptional()
  @IsBoolean()
  acceptedAgreement?: boolean;
}
