import mongoose from 'mongoose';
import { nextSequence } from './Counter.js';

/**
 * Cash that was already in the drawer when the book was started (or topped
 * up from outside the book). It lands in the cash book as a cash-in line on
 * its date, so every running balance after it includes it.
 */
const openingBalanceSchema = new mongoose.Schema(
  {
    shopOwner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    openingNumber: { type: String, unique: true, index: true },

    entryDate: { type: Date, default: Date.now, index: true },
    amount: { type: Number, required: true, min: 0 },
    notes: { type: String, default: '', trim: true },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

openingBalanceSchema.pre('validate', async function (next) {
  try {
    if (!this.openingNumber) {
      const seq = await nextSequence('opening');
      this.openingNumber = `OPN-${String(seq).padStart(5, '0')}`;
    }
    next();
  } catch (err) {
    next(err);
  }
});

export default mongoose.model('OpeningBalance', openingBalanceSchema);
