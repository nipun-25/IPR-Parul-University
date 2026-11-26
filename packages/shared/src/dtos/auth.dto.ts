import { PortalRole } from '../constants/roles.constants.js';

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
