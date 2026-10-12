import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

export interface JwtPayload {
  userId: string;
  email: string;
  role: string;
}

/**
 * Generate a signed JWT token
 */
export function signToken(payload: JwtPayload, expiresIn = env.JWT_EXPIRES_IN): string {
  // @ts-ignore - jsonwebtoken types allow string payload option
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn });
}

/**
 * Verify and decode a JWT token
 */
export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, env.JWT_SECRET) as JwtPayload;
}
