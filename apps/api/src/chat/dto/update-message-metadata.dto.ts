import { IsObject } from 'class-validator';

export class UpdateMessageMetadataDto {
  @IsObject()
  metadata: Record<string, any>;
}
