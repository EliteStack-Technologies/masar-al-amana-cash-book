import mongoose from 'mongoose';
import { ENV_FILE } from './env.js';

/** user@host/db from a connection string, password left out, for the logs. */
function describe(uri) {
  try {
    const u = new URL(uri);
    const who = u.username ? `${decodeURIComponent(u.username)}@` : '(no user) ';
    return `${who}${u.host}${u.pathname}`;
  } catch {
    return '(unreadable MONGO_URI)';
  }
}

export async function connectDB() {
  const uri = process.env.MONGO_URI;
  if (!uri) throw new Error(`MONGO_URI is not set. Check ${ENV_FILE}`);

  console.log(`[db] connecting as ${describe(uri)}`);
  mongoose.set('strictQuery', true);
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 8000 });

  // MongoDB accepts a connection without credentials and only refuses the
  // first query, so a missing login would otherwise surface as a 500 on
  // sign-in. Ask for something that needs a login now and fail loudly.
  try {
    await mongoose.connection.db.listCollections({}, { nameOnly: true }).toArray();
  } catch (err) {
    await mongoose.disconnect();
    if (err.code === 13 || err.code === 18 || /auth/i.test(err.message)) {
      throw new Error(
        `MongoDB refused the login (${err.message}). MONGO_URI in ${ENV_FILE} needs a ` +
          'user and password with access to this database, e.g. ' +
          'mongodb://USER:PASS@127.0.0.1:27017/cashbook?authSource=cashbook'
      );
    }
    throw err;
  }

  console.log(`[db] connected -> ${mongoose.connection.name}`);

  mongoose.connection.on('disconnected', () => console.warn('[db] disconnected'));
  mongoose.connection.on('error', (err) => console.error('[db] error:', err.message));
}
