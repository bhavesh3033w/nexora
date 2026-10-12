import { Response } from 'express';

export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
  errors?: any[];
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
    pages?: number;
  };
}

export function sendSuccess<T>(
  res: Response,
  data: T,
  message = 'Operation successful',
  statusCode = 200
): Response {
  const body: ApiResponse<T> = {
    success: true,
    message,
    data,
  };
  return res.status(statusCode).json(body);
}

export function sendPaginated<T>(
  res: Response,
  data: T[],
  meta: { page: number; limit: number; total: number },
  message = 'Data retrieved successfully'
): Response {
  const pages = Math.ceil(meta.total / meta.limit);
  const body: ApiResponse<T[]> = {
    success: true,
    message,
    data,
    meta: {
      ...meta,
      pages,
    },
  };
  return res.status(200).json(body);
}

export function sendError(
  res: Response,
  message = 'An error occurred',
  statusCode = 500,
  details?: any
): Response {
  const body: ApiResponse = {
    success: false,
    error: message,
    ...(details && { errors: Array.isArray(details) ? details : [details] }),
  };
  return res.status(statusCode).json(body);
}
