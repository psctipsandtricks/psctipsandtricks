import { IsEnum, IsObject, IsOptional, IsString } from 'class-validator';
import { ChatMessageType } from '@prisma/client';

export class SendMessageDto {
  @IsString()
  content: string;

  @IsOptional()
  @IsString()
  groupId?: string;

  @IsOptional()
  @IsString()
  room?: string;

  @IsOptional()
  @IsEnum(ChatMessageType)
  messageType?: ChatMessageType;

  @IsOptional()
  @IsString()
  mediaUrl?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}
