import mongoose from 'mongoose';
import { nextSequence } from './Counter.js';

const capitalSchema = new mongoose.Schema(
  {
    shopOwner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    capitalNumber: { type: String, unique: true, index: true },

    // Who put the cash in, from the capital accounts list; the name is
    // snapshotted so renaming an account never rewrites history.
    account: { type: mongoose.Schema.Types.ObjectId, ref: 'CapitalAccount', required: true, index: true },
    partnerName: { type: String, required: true, trim: true, index: true },
    partnerMobile: { type: String, default: '', trim: true },
    amount: { type: Number, required: true, min: 0 },
    entryDate: { type: Date, default: Date.now, index: true },
    notes: { type: String, default: '', trim: true },

    // Taken back out by the partner. Kept in step by the capital controller so
    // lists and the dashboard can read the balance without an aggregation.
    withdrawnAmount: { type: Number, default: 0, min: 0 },
    status: { type: String, enum: ['open', 'closed'], default: 'open', index: true },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

capitalSchema.index({ entryDate: -1 });

capitalSchema.virtual('balance').get(function () {
  return Math.max(0, Math.round((this.amount - this.withdrawnAmount) * 100) / 100);
});
capitalSchema.set('toJSON', { virtuals: true });
capitalSchema.set('toObject', { virtuals: true });

capitalSchema.pre('validate', async function (next) {
  try {
    if (!this.capitalNumber) {
      const seq = await nextSequence('capital');
      this.capitalNumber = `CAP-${String(seq).padStart(5, '0')}`;
    }
    next();
  } catch (err) {
    next(err);
  }
});

export default mongoose.model('Capital', capitalSchema);
