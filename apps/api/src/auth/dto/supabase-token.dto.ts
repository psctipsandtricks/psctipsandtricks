import { IsString, MinLength } from 'class-validator';

export class SupabaseTokenDto {
  /**
   * The Supabase Auth access token the client obtained after
   * authenticating with Supabase (via Email OTP/Magic Link or Google).
   */
  @IsString()
  @MinLength(10)
  accessToken: string;
}
