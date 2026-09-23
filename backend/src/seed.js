import './config/env.js';
import mongoose from 'mongoose';
import { connectDB } from './config/db.js';
import { ensureOwners } from './owners.js';

/**
 * Creates the two shop-owner logins, or resets their passwords to the ones in
 * backend/.env. Safe to re-run: it never touches transactions. (The API also
 * creates missing logins on startup, but never resets a password.)
 */
async function run() {
  await connectDB();
  await ensureOwners({ resetPasswords: true });
  await mongoose.disconnect();
  console.log('[seed] done');
}

run().catch((err) => {
  console.error('[seed] failed:', err.message);
  process.exit(1);
});
