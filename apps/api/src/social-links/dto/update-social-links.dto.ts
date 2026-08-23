import { IsOptional, IsUrl, Matches, ValidateIf } from 'class-validator';

/**
 * Each field is optional (omit to leave unchanged) and an empty string clears
 * the link — the service trims and nulls it out. Anything non-empty must be
 * a well-formed http(s) URL on the platform's own domain: this both catches
 * an admin pasting the wrong platform's link into the wrong field, and closes
 * off `javascript:` / other non-http schemes ending up in a homepage `href`.
 */
export class UpdateSocialLinksDto {
  @IsOptional()
  @ValidateIf((o) => !!o.telegramUrl)
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true }, { message: 'Enter a valid Telegram link (e.g. https://t.me/yourchannel)' })
  @Matches(/^https?:\/\/(www\.)?(t\.me|telegram\.me|telegram\.org)\//i, {
    message: 'Telegram link must point to t.me, telegram.me, or telegram.org',
  })
  telegramUrl?: string;

  @IsOptional()
  @ValidateIf((o) => !!o.instagramUrl)
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true }, { message: 'Enter a valid Instagram link (e.g. https://instagram.com/yourpage)' })
  @Matches(/^https?:\/\/(www\.)?(instagram\.com|instagr\.am)\//i, {
    message: 'Instagram link must point to instagram.com',
  })
  instagramUrl?: string;

  @IsOptional()
  @ValidateIf((o) => !!o.youtubeUrl)
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true }, { message: 'Enter a valid YouTube link (e.g. https://youtube.com/@yourchannel)' })
  @Matches(/^https?:\/\/(www\.)?(youtube\.com|youtu\.be|m\.youtube\.com)\//i, {
    message: 'YouTube link must point to youtube.com or youtu.be',
  })
  youtubeUrl?: string;

  @IsOptional()
  @ValidateIf((o) => !!o.facebookUrl)
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true }, { message: 'Enter a valid Facebook link (e.g. https://facebook.com/yourpage)' })
  @Matches(/^https?:\/\/(www\.)?(facebook\.com|fb\.com|fb\.me)\//i, {
    message: 'Facebook link must point to facebook.com',
  })
  facebookUrl?: string;

  @IsOptional()
  @ValidateIf((o) => !!o.twitterUrl)
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true }, { message: 'Enter a valid Twitter/X link (e.g. https://x.com/yourhandle)' })
  @Matches(/^https?:\/\/(www\.)?(twitter\.com|x\.com)\//i, {
    message: 'Twitter link must point to twitter.com or x.com',
  })
  twitterUrl?: string;
}
