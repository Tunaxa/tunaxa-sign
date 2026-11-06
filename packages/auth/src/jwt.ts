import jwt, { type SignOptions } from "jsonwebtoken";
import type { JwtPayload, TokenPair } from "./types";
import { generateToken } from "@axa-sign/shared";

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";
const JWT_EXPIRES_IN = (process.env.JWT_EXPIRES_IN || "15m") as SignOptions["expiresIn"];
const REFRESH_EXPIRES_IN = (process.env.JWT_REFRESH_EXPIRES_IN || "7d") as SignOptions["expiresIn"];

export function signAccessToken(payload: Omit<JwtPayload, "iat" | "exp">): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

export function signRefreshToken(payload: Omit<JwtPayload, "iat" | "exp">): string {
  return jwt.sign({ ...payload, type: "refresh" }, JWT_SECRET, {
    expiresIn: REFRESH_EXPIRES_IN,
  });
}

export function generateTokenPair(
  payload: Omit<JwtPayload, "iat" | "exp">
): TokenPair {
  const accessToken = signAccessToken(payload);
  const refreshToken = signRefreshToken(payload);

  const decoded = jwt.decode(accessToken) as JwtPayload;
  const expiresIn = decoded.exp
    ? decoded.exp - Math.floor(Date.now() / 1000)
    : 900;

  return { accessToken, refreshToken, expiresIn };
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, JWT_SECRET) as JwtPayload;
}

export function generateSigningToken(): { token: string; hash: string } {
  const { hashToken } = require("@axa-sign/shared");
  const token = generateToken(32);
  const hash = hashToken(token);
  return { token, hash };
}
