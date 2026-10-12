import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './auth.js';

export function requireRole(...allowedRoles: Array<'user' | 'admin' | 'manager'>) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: 'Authentication required before checking permissions.',
      });
      return;
    }

    if (!allowedRoles.includes(req.user.role as any)) {
      res.status(403).json({
        success: false,
        error: `Access denied. Requires one of roles: [${allowedRoles.join(', ')}]. Current role: '${req.user.role}'.`,
      });
      return;
    }

    next();
  };
}

export const requireAdmin = requireRole('admin');
