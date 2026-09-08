import { ArrayMaxSize, IsArray, IsOptional, IsString } from 'class-validator';

export class MarkNotificationsReadDto {
  /**
   * Which notifications to mark. Omitted means "everything I can currently
   * see", which is what a "mark all as read" button wants without having to
   * send the whole list back.
   *
   * The cap matches the window `getUserNotifications` returns — a client has
   * no way to know about more than that, so a longer list is a bug, not a
   * bigger request.
   */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @IsString({ each: true })
  ids?: string[];
}
