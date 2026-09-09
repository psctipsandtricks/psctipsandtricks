import { PartialType } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';
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

  /**
   * Terms a student must accept before joining. Blank means no gate, which is
   * how a group behaves unless an admin writes one.
   */
  @IsOptional()
  @IsString()
  @MaxLength(10000)
  agreement?: string;
}
