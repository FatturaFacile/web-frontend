export interface User {
  id: number | string;
  name: string;
  email: string;
  [key: string]: unknown;
}

export interface LoginCredentials {
  email: string;
  password: string;
  remember?: boolean;
}

export interface AuthResponse {
  user: User;
  token?: string;
  expires_in?: number;
}
