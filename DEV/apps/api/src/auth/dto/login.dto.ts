import { IsNotEmpty, IsString } from 'class-validator';

/**
 * Body for POST /api/auth/login — CoShare username + password.
 * Proxied server-side to CoShare's oauth2/token (password grant); the credentials
 * never touch the browser storage and are never logged.
 */
export class LoginDto {
  @IsString()
  @IsNotEmpty()
  username!: string;

  @IsString()
  @IsNotEmpty()
  password!: string;
}
