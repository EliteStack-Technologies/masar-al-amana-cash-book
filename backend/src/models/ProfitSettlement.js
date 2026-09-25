import mongoose from 'mongoose';
import { nextSequence } from './Counter.js';

/**
 * Profit paid out of the shop to a partner. The P/L screen works the profit
 * out from the book itself; these rows are what has been shared out of it,
 * and each one is cash leaving the drawer.
 */
const profitSettlementSchema = new mongoose.Schema(
  {
    shopOwner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    settlementNumber: { type: String, unique: true, index: true },

    // Partners are the capital accounts; the name is snapshotted so renaming
    // an account never rewrites history.
    account: { type: mongoose.Schema.Types.ObjectId, ref: 'CapitalAccount', required: true, index: true },
    partnerName: { type: String, required: true, trim: true },
    amount: { type: Number, required: true, min: 0 },
    entryDate: { type: Date, default: Date.now, index: true },
    notes: { type: String, default: '', trim: true },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

profitSettlementSchema.pre('validate', async function (next) {
  try {
    if (!this.settlementNumber) {
      const seq = await nextSequence('profitSettlement');
      this.settlementNumber = `PLS-${String(seq).padStart(5, '0')}`;
    }
    next();
  } catch (err) {
    next(err);
  }
});

export default mongoose.model('ProfitSettlement', profitSettlementSchema);
