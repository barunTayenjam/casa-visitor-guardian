export type UserRole = 'admin' | 'user' | 'viewer';

export interface AuthUser {
  id: string;
  username: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  lastLogin?: string;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface RegisterRequest {
  username: string;
  email: string;
  password: string;
  role?: UserRole;
}

export interface AuthResponse {
  success: true;
  message: string;
  user?: AuthUser;
  token?: string;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}
