import './config/env.js';
import mongoose from 'mongoose';
import { connectDB } from './config/db.js';

/**
 * Deletes every document in every collection of the database in MONGO_URI,
 * users included. Collections and indexes are kept. Cannot be undone.
 *
 * Refuses to run unless the database name is repeated on the command line:
 *   npm run wipe -- --confirm cashbook
 *
 * The API recreates the two owner logins from src/owners.js on its next start.
 */
async function run() {
  await connectDB();
  const db = mongoose.connection.db;
  const name = db.databaseName;

  const i = process.argv.indexOf('--confirm');
  const confirmed = i !== -1 ? process.argv[i + 1] : undefined;
  if (confirmed !== name) {
    await mongoose.disconnect();
    throw new Error(`refusing to wipe "${name}". Re-run with: npm run wipe -- --confirm ${name}`);
  }

  const collections = await db.listCollections({ type: 'collection' }, { nameOnly: true }).toArray();
  for (const { name: coll } of collections) {
    if (coll.startsWith('system.')) continue;
    const { deletedCount } = await db.collection(coll).deleteMany({});
    console.log(`[wipe] ${coll}: deleted ${deletedCount}`);
  }

  await mongoose.disconnect();
  console.log(`[wipe] "${name}" is empty`);
}

run().catch((err) => {
  console.error('[wipe] failed:', err.message);
  process.exit(1);
});
