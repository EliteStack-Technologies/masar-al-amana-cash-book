import './config/env.js';
import mongoose from 'mongoose';
import { connectDB } from './config/db.js';
import User from './models/User.js';
import { ensureOwners } from './owners.js';

/**
 * Deletes EVERY user, then creates the two shop-owner logins fresh from
 * backend/.env (or the defaults in owners.js).
 *
 * The new logins get new ids, and all shop data is keyed to the owner's id,
 * so anything already in the database stops showing in the app. Only for a
 * database with no real data. Needs --yes:
 *   npm run reset-users -- --yes
 */
async function run() {
  if (!process.argv.includes('--yes')) {
    console.error('[reset-users] this deletes ALL users. Re-run with: npm run reset-users -- --yes');
    process.exit(1);
  }

  await connectDB();

  const { deletedCount } = await User.deleteMany({});
  console.log(`[reset-users] deleted ${deletedCount} user(s)`);

  await ensureOwners();

  await mongoose.disconnect();
  console.log('[reset-users] done');
}

run().catch((err) => {
  console.error('[reset-users] failed:', err.message);
  process.exit(1);
});
