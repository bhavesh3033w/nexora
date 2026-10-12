import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';

export interface AppError extends Error {
  statusCode?: number;
  code?: number | string;
  errors?: any;
}

export function errorHandler(
  err: AppError,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal Server Error';
  let errors: any = undefined;

  // Handle Mongoose Validation Error
  if (err.name === 'ValidationError' && (err as any).errors) {
    statusCode = 400;
    message = 'Validation failed';
    errors = Object.values((err as any).errors).map((e: any) => ({
      field: e.path,
      message: e.message,
    }));
  }

  // Handle Mongoose Duplicate Key Error (E11000)
  if ((err as any).code === 11000) {
    statusCode = 409;
    const field = Object.keys((err as any).keyValue || {})[0] || 'field';
    message = `Duplicate value for ${field}. A record with that ${field} already exists.`;
  }

  // Handle Mongoose CastError (invalid ObjectId)
  if (err.name === 'CastError') {
    statusCode = 400;
    message = `Invalid ID format for ${(err as any).path}: ${(err as any).value}`;
  }

  // Handle JWT Errors
  if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Invalid authentication token';
  } else if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Authentication token has expired';
  }

  // Handle Zod Validation Errors
  if (err instanceof ZodError) {
    statusCode = 400;
    message = 'Invalid input parameters';
    errors = err.errors.map((e) => ({
      path: e.path.join('.'),
      message: e.message,
    }));
  }

  if (statusCode === 500) {
    console.error('[ServerError]', err);
  }

  res.status(statusCode).json({
    success: false,
    error: message,
    ...(errors && { errors }),
  });
}

export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    success: false,
    error: `Endpoint not found: ${req.method} ${req.originalUrl}`,
  });
}
