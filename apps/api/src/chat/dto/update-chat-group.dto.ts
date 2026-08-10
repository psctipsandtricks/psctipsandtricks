import { PartialType } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';
import { CreateChatGroupDto } from './create-chat-group.dto';

export class UpdateChatGroupDto extends PartialType(CreateChatGroupDto) {
  /** When false, students can no longer send text messages in this group. */
  @IsOptional()
  @IsBoolean()
  allowTextMessages?: boolean;

  /** When false, students can no longer post polls in this group. */
  @IsOptional()
  @IsBoolean()
  allowPolls?: boolean;
}
