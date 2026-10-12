import express, { Express } from 'express';
import cors from 'cors';
import morgan from 'morgan';
import { env } from './config/env.js';
import { connectDB, disconnectDB } from './config/db.js';
import apiRouter from './routes/index.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';

export function createServer(): Express {
  const app = express();

  // Basic request logging
  if (env.NODE_ENV !== 'test') {
    app.use(morgan('dev'));
  }

  // Cross-Origin Resource Sharing
  const allowedOrigins = env.CORS_ORIGIN === '*' ? '*' : env.CORS_ORIGIN.split(',');
  app.use(
    cors({
      origin: allowedOrigins,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    })
  );

  // Body parsing
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Root welcome & API info
  app.get('/', (_req, res) => {
    res.json({
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

  // Mount API V1 and unversioned API routes
  app.use('/api/v1', apiRouter);
  app.use('/api', apiRouter);

  // Fallback 404 handler
  app.use(notFoundHandler);

  // Global centralized error handler
  app.use(errorHandler);

  return app;
}

export async function startServer(): Promise<void> {
  const app = createServer();
  const port = env.PORT;

  // Connect to Database
  try {
    await connectDB();
  } catch (err) {
    console.warn('[Server] Notice: Database connection attempt logged. Server continuing in operational mode.');
  }

  const server = app.listen(port, () => {
    console.log(`=========================================`);
    console.log(` Nexora MERN Backend Service Started`);
    console.log(` Port: ${port}`);
    console.log(` Environment: ${env.NODE_ENV}`);
    console.log(` Health: http://localhost:${port}/api/v1/health`);
    console.log(`=========================================`);
  });

  // Graceful shutdown handling
  const shutdown = async (signal: string) => {
    console.log(`\n[Server] Received ${signal}. Shutting down gracefully...`);
    server.close(async () => {
      console.log('[Server] HTTP listener closed.');
      await disconnectDB();
      process.exit(0);
    });

    setTimeout(() => {
      console.error('[Server] Forced shutdown timeout exceeded.');
      process.exit(1);
    }, 10000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

// Auto-run if executed directly
if (process.argv[1]?.includes('server.ts') || process.argv[1]?.includes('server.js')) {
  startServer().catch((err) => {
    console.error('[Server] Fatal startup error:', err);
    process.exit(1);
  });
}
