import express from 'express';
import cookieParser from 'cookie-parser';
import path from 'path';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';
import { initDatabase } from './server/db.ts';
import { authRoutes } from './server/routes/authRoutes.ts';
import { adminRoutes } from './server/routes/adminRoutes.ts';
import { bkRoutes } from './server/routes/bkRoutes.ts';
import { studentRoutes } from './server/routes/studentRoutes.ts';
import { materialsRoutes } from './server/routes/materialsRoutes.ts';
import { aiRoutes } from './server/routes/aiRoutes.ts';

dotenv.config();

async function startServer() {
  initDatabase();

  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json({ limit: '10mb' }));
  app.use(cookieParser());

  // API Routes
  app.use('/api/auth', authRoutes);
  app.use('/api/admin', adminRoutes);
  app.use('/api/bk', bkRoutes);
  app.use('/api/student', studentRoutes);
  app.use('/api/materials', materialsRoutes);
  app.use('/api/ai', aiRoutes);

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, app: 'DIGITAL BALANCE' });
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`DIGITAL BALANCE server running on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
