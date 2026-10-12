import { Request, Response, NextFunction } from 'express';
import { verifyToken, JwtPayload } from '../utils/jwt.js';

export interface AuthenticatedRequest extends Request {
  user?: JwtPayload;
}

/**
 * Middleware to require valid JWT Bearer token
 */
export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      success: false,
      error: 'Authorization header missing or invalid. Expected "Bearer <token>"',
    });
    return;
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = verifyToken(token);
    req.user = decoded;
    next();
  } catch (err: any) {
    if (err.name === 'TokenExpiredError') {
      res.status(401).json({
        success: false,
        error: 'Authentication token has expired. Please log in again.',
      });
      return;
    }
    res.status(401).json({
      success: false,
      error: 'Invalid authentication token.',
    });
  }
}

/**
 * Optional authentication: if token is present and valid, sets req.user
 */
export function optionalAuth(req: AuthenticatedRequest, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    try {
      req.user = verifyToken(token);
    } catch {
      // Ignore invalid token in optional auth
    }
  }

  next();
}
