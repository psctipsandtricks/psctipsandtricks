import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

/** The kinds the student app knows how to colour and icon. */
export const NOTIFICATION_TYPES = [
  'ANNOUNCEMENT',
  'BOOK',
  'QUIZ',
  'MOCK_TEST',
  'ORDER',
  'CHAT',
] as const;

export class SendNotificationDto {
  @IsString()
  @MaxLength(100)
  title: string;

  @IsString()
  @MaxLength(500)
  body: string;

  /** Omitted for a broadcast to every student. */
  @IsOptional()
  @IsString()
  userId?: string;

  @IsOptional()
  @IsString()
  target?: string;

  @IsOptional()
  @IsIn(NOTIFICATION_TYPES)
  type?: string;

  /** In-app route (`/books/<id>`) or an https link. */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  route?: string;

  /** 16:9 banner image URL */
  @IsOptional()
  @IsString()
  imageUrl?: string;

  /** Optional future ISO date string for scheduling */
  @IsOptional()
  @IsString()
  scheduledFor?: string;
}
