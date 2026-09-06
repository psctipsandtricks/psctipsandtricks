import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateSocialLinksDto } from './dto/update-social-links.dto';

/** Every row is this one id — there is exactly one settings record, ever. */
const SINGLETON_ID = 'singleton';

@Injectable()
export class SocialLinksService {
  constructor(private prisma: PrismaService) {}

  /** Public — the homepage calls this directly; no row yet just means every link is unset. */
  async get() {
    const existing = await this.prisma.socialLinks.findUnique({ where: { id: SINGLETON_ID } });
    return (
      existing ?? {
        id: SINGLETON_ID,
        telegramUrl: null,
        instagramUrl: null,
        youtubeUrl: null,
        facebookUrl: null,
        twitterUrl: null,
        playStoreUrl: null,
        appStoreUrl: null,
        updatedAt: null,
      }
    );
  }

  /**
   * A field absent from `dto` is left untouched; an empty string clears it.
   * Whitespace-only input clears too, so a stray space doesn't masquerade as
   * a configured link on the home page.
   */
  async update(dto: UpdateSocialLinksDto) {
    const normalize = (value?: string) => {
      if (value === undefined) return undefined;
      const trimmed = value.trim();
      return trimmed.length > 0 ? trimmed : null;
    };

    const data = {
      telegramUrl: normalize(dto.telegramUrl),
      instagramUrl: normalize(dto.instagramUrl),
      youtubeUrl: normalize(dto.youtubeUrl),
      facebookUrl: normalize(dto.facebookUrl),
      twitterUrl: normalize(dto.twitterUrl),
      playStoreUrl: normalize(dto.playStoreUrl),
      appStoreUrl: normalize(dto.appStoreUrl),
    };

    return this.prisma.socialLinks.upsert({
      where: { id: SINGLETON_ID },
      create: { id: SINGLETON_ID, ...data },
      update: data,
    });
  }
}
