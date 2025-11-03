import express from 'express';
import cors from 'cors';
import path from 'path';
import { loadEnv } from './lib/env';
import timetableRouter from './routes/timetable';
import healthRouter from './routes/health';
import requestsRouter from './routes/requests';
import authRouter from './routes/auth';

const env = loadEnv();

export const app = express();

const allowedOrigins = env.ALLOWED_ORIGINS.split(',').map((o) => o.trim()).filter(Boolean);
app.use(cors({ origin: allowedOrigins.length ? allowedOrigins : true }));
app.use(express.json());

// Serve static frontend
app.use(express.static(path.join(process.cwd(), 'public')));

app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

app.use('/timetable', timetableRouter);
app.use('/health', healthRouter);
app.use('/requests', requestsRouter);
app.use('/auth', authRouter);

// Start server only in non-serverless environments
if (!process.env.NETLIFY) {
  const port = Number(env.PORT || 3000);
  app.listen(port, () => {
    // eslint-disable-next-line no-console
    console.log(`Server listening on http://localhost:${port}`);
  });
}
