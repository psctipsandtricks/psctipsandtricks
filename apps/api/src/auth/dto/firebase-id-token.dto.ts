import { IsString, MinLength } from 'class-validator';

export class FirebaseIdTokenDto {
  /**
   * The Firebase Auth ID token the app holds after completing an email link
   * sign-in on the device.
   */
  @IsString()
  @MinLength(10)
  idToken: string;
}
