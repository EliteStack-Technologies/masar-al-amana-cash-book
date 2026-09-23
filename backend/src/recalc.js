import 'dotenv/config';
import mongoose from 'mongoose';
import { connectDB } from './config/db.js';
import Transaction from './models/Transaction.js';
import { computeAmounts } from './utils/calc.js';

/**
 * Re-derives every money field on every transaction from the inputs the owner
 * typed, so rows written under an older formula stop skewing the reports.
 *
 * Dry run by default; pass --apply to write. Settlement status, dates and
 * batch links are never touched - this fixes amounts only.
 *
 * Validation is limited to the fields this script modifies, so a legacy row
 * that predates a required field still gets its maths corrected.
 */
const DERIVED = [
  'givenAmount',
  'chargeToCustomer',
  'custPercent',
  'supplierFee',
  'supplierAccount',
  'margin',
  'profit',
];

const drifted = (a, b) => {
  if (a === null || a === undefined || b === null || b === undefined) return a !== b;
  return Math.abs(Number(a) - Number(b)) > 0.009;
};

async function run() {
  const apply = process.argv.includes('--apply');
  await connectDB();

  // Full documents, not lean: save() re-runs the pre-validate hook.
  const txns = await Transaction.find({}).sort({ txnNumber: 1 });
  let changed = 0;
  let updated = 0;
  let failed = 0;

  for (const txn of txns) {
    const fresh = computeAmounts(txn);
    const diffs = DERIVED.filter((key) => drifted(txn[key], fresh[key]));
    if (!diffs.length) continue;

    changed += 1;
    for (const key of diffs) {
      console.log(`[recalc] ${txn.txnNumber}  ${key} ${txn[key]} -> ${fresh[key]}`);
    }

    if (apply) {
      try {
        // The model's pre-validate hook assigns computeAmounts() itself, so
        // save() stays the single source of truth for the maths.
        await txn.save({ validateModifiedOnly: true });
        updated += 1;
      } catch (err) {
        // One unsaveable row must not abandon the rest of the backfill.
        failed += 1;
        console.error(`[recalc] ${txn.txnNumber} could not be saved: ${err.message}`);
      }
    }
  }

  console.log(
    `[recalc] scanned ${txns.length}, drifted ${changed}, updated ${updated}, failed ${failed}`
  );
  if (changed && !apply) console.log('[recalc] run with --apply to write');

  await mongoose.disconnect();
}

run().catch((err) => {
  console.error('[recalc] failed:', err.message);
  process.exit(1);
});
