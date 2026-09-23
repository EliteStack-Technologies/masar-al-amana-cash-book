import { ENV_FILE } from './config/env.js';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';

import { connectDB } from './config/db.js';
import { ensureOwners } from './owners.js';
import routes from './routes/index.js';
import { notFound, errorHandler } from './middleware/error.js';

const app = express();

app.set('trust proxy', 1);
app.use(
  cors({
    origin: (process.env.CLIENT_ORIGIN || 'http://localhost:3000').split(','),
    credentials: true,
  })
);
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());

app.use('/api', routes);
app.use(notFound);
app.use(errorHandler);

const port = process.env.PORT || 5000;

console.log(`[api] starting from ${process.cwd()} using ${ENV_FILE}`);

connectDB()
  .then(() => ensureOwners())
  .then(() => {
    app.listen(port, () => console.log(`[api] listening on http://localhost:${port}/api`));
  })
  .catch((err) => {
    console.error('[api] failed to start:', err.message);
    process.exit(1);
  });
