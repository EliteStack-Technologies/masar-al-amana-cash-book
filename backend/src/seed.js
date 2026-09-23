import './config/env.js';
import mongoose from 'mongoose';
import { connectDB } from './config/db.js';
import { ensureOwners } from './owners.js';

/**
 * Resets the two shop-owner logins to the passwords in src/owners.js right
 * away, without waiting for a deploy. Safe to re-run: it never touches
 * transactions. (The API already creates them on every start.)
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
