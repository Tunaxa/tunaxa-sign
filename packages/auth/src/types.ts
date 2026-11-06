export interface JwtPayload {
  sub: string;
  email: string;
  organizationId: string;
  role: string;
  iat?: number;
  exp?: number;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  organizationId: string;
  role: string;
}
