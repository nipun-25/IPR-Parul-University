import { z } from 'zod';
import { PortalRole } from '../constants/roles.constants.js';

export const STUDENT_EMAIL_REGEX = /^[^@]+@paruluniversity\.ac\.in$/;
export const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*[\d\W]).{8,128}$/;

export const RegisterStudentSchema = z.object({
  email: z
    .string({ required_error: 'Email is required' })
    .trim()
    .toLowerCase()
    .email('Invalid email address')
    .refine(
      (val) => STUDENT_EMAIL_REGEX.test(val),
      { message: 'Registration is restricted strictly to @paruluniversity.ac.in student emails' }
    ),
  fullName: z
    .string({ required_error: 'Full name is required' })
    .trim()
    .min(2, 'Full name must be at least 2 characters long')
    .max(100, 'Full name cannot exceed 100 characters')
    .refine((val) => val.length > 0, { message: 'Full name cannot be empty' }),
  password: z
    .string({ required_error: 'Password is required' })
    .min(8, 'Password must be at least 8 characters long')
    .max(128, 'Password cannot exceed 128 characters')
    .refine(
      (val) => PASSWORD_REGEX.test(val),
      { message: 'Password must contain at least one uppercase letter, one lowercase letter, and one number or symbol' }
    )
}).strict();

export type RegisterStudentDto = z.infer<typeof RegisterStudentSchema>;

export interface RegisterStudentResponseDto {
  success: boolean;
  message: string;
}

export const VerifyEmailSchema = z.object({
  token: z
    .string({ required_error: 'Verification token is required' })
    .trim()
    .regex(/^[a-f0-9]{64}$/i, 'Verification token must be a 64-character hexadecimal string')
}).strict();

export type VerifyEmailDto = z.infer<typeof VerifyEmailSchema>;

export interface VerifyEmailResponseDto {
  success: boolean;
  message: string;
  userId: string;
}

export interface UserProfileDto {
  id: string;
  puUid: string;
  email: string;
  fullName: string;
  activeRoles: PortalRole[];
  isActive: boolean;
}

export interface LoginResponseDto {
  user: UserProfileDto;
  csrfToken: string;
}

export interface RegisterUserDto {
  inviteToken: string;
  fullName: string;
}
