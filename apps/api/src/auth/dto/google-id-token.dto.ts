import { IsOptional, IsString, MinLength } from 'class-validator';

export class GoogleIdTokenDto {
  /**
   * The ID token the native Google Sign-In flow returned on the device.
   */
  @IsOptional()
  @IsString()
  @MinLength(10)
  idToken?: string;

  /**
   * Optional OAuth access token from Google Sign-In.
   */
  @IsOptional()
  @IsString()
  @MinLength(10)
  accessToken?: string;
}
