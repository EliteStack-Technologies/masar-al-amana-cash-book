import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

/**
 * Loads backend/.env by its own path, not the working directory, so the API,
 * the seed and recalc read the same settings however PM2 or a shell was
 * started. Import this first, before anything reads process.env.
 *
 * `override` makes the file win over anything already in the environment -
 * PM2 keeps the environment a process was first started with, so an edited
 * .env would otherwise be ignored on restart.
 */
const here = path.dirname(fileURLToPath(import.meta.url));
export const ENV_FILE = path.resolve(here, '../../.env');

dotenv.config({ path: ENV_FILE, override: true });
