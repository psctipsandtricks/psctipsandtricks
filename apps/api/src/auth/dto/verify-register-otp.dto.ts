import { IsEmail, IsString } from 'class-validator';

export class VerifyRegisterOtpDto {
  @IsEmail()
  email: string;

  @IsString()
  otp: string;
}
