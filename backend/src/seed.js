import 'dotenv/config';
import mongoose from 'mongoose';
import { connectDB } from './config/db.js';
import User from './models/User.js';

/**
 * Creates (or updates the password of) the two shop-owner logins defined in
 * backend/.env. Safe to re-run: it never touches transactions.
 */
const accounts = [
  {
    name: process.env.OWNER1_NAME || 'Shop Owner 1',
    email: process.env.OWNER1_EMAIL,
    password: process.env.OWNER1_PASSWORD,
  },
  {
    name: process.env.OWNER2_NAME || 'Shop Owner 2',
    email: process.env.OWNER2_EMAIL,
    password: process.env.OWNER2_PASSWORD,
  },
];

async function run() {
  await connectDB();

  for (const acc of accounts) {
    if (!acc.email || !acc.password) {
      console.warn(`[seed] skipped "${acc.name}" - email or password missing in .env`);
      continue;
    }

    const email = acc.email.toLowerCase().trim();
    let user = await User.findOne({ email });

    if (!user) {
      user = new User({ name: acc.name, email });
      await user.setPassword(acc.password);
      await user.save();
      console.log(`[seed] created ${email}`);
    } else {
      user.name = acc.name;
      await user.setPassword(acc.password);
      await user.save();
      console.log(`[seed] updated password for ${email}`);
    }
  }

  await mongoose.disconnect();
  console.log('[seed] done');
}

run().catch((err) => {
  console.error('[seed] failed:', err.message);
  process.exit(1);
});
