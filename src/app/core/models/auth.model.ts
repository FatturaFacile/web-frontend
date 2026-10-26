export interface User {
  id: number;
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
  token: string;
  user: User;
  expires_in?: number;
}
