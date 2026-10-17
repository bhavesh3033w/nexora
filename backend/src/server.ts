
import express, { Express } from 'express';
import cors from 'cors';
import morgan from 'morgan';

import { env } from './config/env.js';
import { connectDB, disconnectDB } from './config/db.js';
import apiRouter from './routes/index.js';
import {
  errorHandler,
  notFoundHandler,
} from './middleware/errorHandler.js';

const LOCAL_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:5176',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:5176',
];

function getAllowedOrigins(): string[] {
  const configuredOrigins = (env.CORS_ORIGIN || '')
    .split(',')
    .map((origin) => origin.trim().replace(/\/$/, ''))
    .filter(Boolean);

  // Include configured origins and common local Vite development ports.
  return [
    ...new Set([...LOCAL_ORIGINS, ...configuredOrigins]),
  ];
}

export function createServer(): Express {
  const app = express();
  const allowedOrigins = getAllowedOrigins();

  // Basic request logging
  if (env.NODE_ENV !== 'test') {
    app.use(morgan('dev'));
  }

  // CORS must run before API routes and handle preflight requests.
  app.use(
    cors({
      origin: (origin, callback) => {
        // Requests without an Origin header can include server-side
        // calls and health checks.
        if (!origin || allowedOrigins.includes(origin.replace(/\/$/, ''))) {
          return callback(null, true);
        }

        console.warn(`[CORS] Blocked origin: ${origin}`);
        return callback(
          new Error(`Origin ${origin} is not allowed by CORS`)
        );
      },
      credentials: true,
      methods: [
        'GET',
        'HEAD',
        'POST',
        'PUT',
        'PATCH',
        'DELETE',
        'OPTIONS',
      ],
      allowedHeaders: [
        'Content-Type',
        'Authorization',
        'X-Requested-With',
      ],
      optionsSuccessStatus: 204,
    })
  );

  // Body parsing
  app.use(express.json({ limit: '10mb' }));
  app.use(
    express.urlencoded({
      extended: true,
      limit: '10mb',
    })
  );

  // Root welcome & API information
  app.get('/', (_req, res) => {
    res.status(200).json({
      name: 'Nexora API Service',
      version: '1.0.0',
      status: 'active',
      endpoints: {
        api: '/api',
        apiV1: '/api/v1',
        health: '/api/v1/health',
      },
    });
  });

  // API routes
  app.use('/api/v1', apiRouter);
  app.use('/api', apiRouter);

  // Fallback 404 and centralized error handling
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

export async function startServer(): Promise<void> {
  const app = createServer();
  const port = env.PORT;

  try {
    await connectDB();
  } catch (error) {
    console.error('[Server] MongoDB connection failed:', error);
    // Keep the server alive so health and diagnostic endpoints can respond.
    // Database-dependent endpoints may still fail until MongoDB reconnects.
  }

  const server = app.listen(port, () => {
    console.log('=========================================');
    console.log(' Nexora MERN Backend Service Started');
    console.log(` Port: ${port}`);
    console.log(` Environment: ${env.NODE_ENV}`);
    console.log(` Health: http://localhost:${port}/api/v1/health`);
    console.log(' Allowed CORS origins:');
    getAllowedOrigins().forEach((origin) => {
      console.log(`  - ${origin}`);
    });
    console.log('=========================================');
  });

  let shuttingDown = false;

  const shutdown = async (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;

    console.log(`\n[Server] Received ${signal}. Shutting down...`);

    const forceExitTimer = setTimeout(() => {
      console.error('[Server] Shutdown timed out.');
      process.exit(1);
    }, 10000);

    try {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) reject(error);
          else resolve();
        });
      });

      console.log('[Server] HTTP listener closed.');
      await disconnectDB();
      clearTimeout(forceExitTimer);
      process.exit(0);
    } catch (error) {
      clearTimeout(forceExitTimer);
      console.error('[Server] Error during shutdown:', error);
      process.exit(1);
    }
  };

  process.once('SIGTERM', () => void shutdown('SIGTERM'));
  process.once('SIGINT', () => void shutdown('SIGINT'));
}

// Start only when this file is executed directly.
if (
  process.argv[1]?.includes('server.ts') ||
  process.argv[1]?.includes('server.js')
) {
  startServer().catch((error) => {
    console.error('[Server] Fatal startup error:', error);
    process.exit(1);
  });
}
