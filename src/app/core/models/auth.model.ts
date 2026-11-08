export interface User {
  id: number | string;
  name: string;
  email: string;
  [key: string]: unknown;
}

