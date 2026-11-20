import express from 'express';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import { initDatabase } from './db.ts';
import { authRoutes } from './routes/authRoutes.ts';
import { adminRoutes } from './routes/adminRoutes.ts';
import { bkRoutes } from './routes/bkRoutes.ts';
import { studentRoutes } from './routes/studentRoutes.ts';
import { materialsRoutes } from './routes/materialsRoutes.ts';
import { aiRoutes } from './routes/aiRoutes.ts';

dotenv.config();

export function createApp() {
  initDatabase();

  const app = express();
  app.set('trust proxy', 1);
  app.use(express.json({ limit: '10mb' }));
  app.use(cookieParser());

  app.use('/api/auth', authRoutes);
  app.use('/api/admin', adminRoutes);
  app.use('/api/bk', bkRoutes);
  app.use('/api/student', studentRoutes);
  app.use('/api/materials', materialsRoutes);
  app.use('/api/ai', aiRoutes);

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, app: 'DIGITAL BALANCE' });
  });

  return app;
}
