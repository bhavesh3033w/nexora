import dotenv from 'dotenv';
import path from 'path';

// Load the backend .env file explicitly.
dotenv.config({
  path: path.resolve(process.cwd(), '.env'),
});

export const env = {
  PORT: parseInt(process.env.PORT || '5000', 10),
  NODE_ENV: process.env.NODE_ENV || 'development',

  // Do not silently fall back to local MongoDB.
  MONGODB_URI: process.env.MONGODB_URI || '',

  JWT_SECRET:
    process.env.JWT_SECRET || 'nexora_default_jwt_secret_change_me_in_prod',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
  CORS_ORIGIN: process.env.CORS_ORIGIN || '*',

  GEMINI_API_KEY: process.env.GEMINI_API_KEY || '',
  OPENAI_API_KEY: process.env.OPENAI_API_KEY || '',
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID || '',
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET || '',
};