import mongoose from 'mongoose';
import { env } from './env.js';

let isConnected = false;

export async function connectDB(): Promise<typeof mongoose | null> {
  if (isConnected) {
    return mongoose;
  }

  const uri = env.MONGODB_URI;

  try {
    const conn = await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });

    isConnected = true;
    console.log(`[MongoDB] Connected successfully to host: ${conn.connection.host} / database: ${conn.connection.name}`);

    mongoose.connection.on('error', (err) => {
      console.error('[MongoDB] Runtime connection error:', err);
    });

    mongoose.connection.on('disconnected', () => {
      console.warn('[MongoDB] Disconnected from server');
      isConnected = false;
    });

    return conn;
  } catch (error) {
    console.error('[MongoDB] Initial connection error:', error);
    // In development or when Atlas credentials are not yet configured, do not crash the server immediately
    if (env.NODE_ENV === 'production') {
      throw error;
    }
    return null;
  }
}

export async function disconnectDB(): Promise<void> {
  if (!isConnected) return;
  await mongoose.disconnect();
  isConnected = false;
  console.log('[MongoDB] Connection closed.');
}

export function isDbConnected(): boolean {
  return mongoose.connection.readyState === 1;
}
