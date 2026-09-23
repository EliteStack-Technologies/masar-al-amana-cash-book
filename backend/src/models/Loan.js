import mongoose from 'mongoose';
import { nextSequence } from './Counter.js';

const loanSchema = new mongoose.Schema(
  {
    shopOwner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    loanNumber: { type: String, unique: true, index: true },

    // Who put the cash in. Chosen from the customer list; the name is
    // snapshotted so renaming a customer never rewrites loan history.
    customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', default: null, index: true },
    lenderName: { type: String, required: true, trim: true, index: true },
    lenderMobile: { type: String, default: '', trim: true },
    principal: { type: Number, required: true, min: 0 },
    entryDate: { type: Date, default: Date.now, index: true },
    notes: { type: String, default: '', trim: true },

    // Repaid to the lender. Kept in step by the loan controller so lists and
    // the dashboard can read the outstanding balance without an aggregation.
    settledAmount: { type: Number, default: 0, min: 0 },
    status: { type: String, enum: ['open', 'closed'], default: 'open', index: true },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

loanSchema.index({ entryDate: -1 });

loanSchema.virtual('outstanding').get(function () {
  return Math.max(0, Math.round((this.principal - this.settledAmount) * 100) / 100);
});
loanSchema.set('toJSON', { virtuals: true });
loanSchema.set('toObject', { virtuals: true });

loanSchema.pre('validate', async function (next) {
  try {
    if (!this.loanNumber) {
      const seq = await nextSequence('loan');
      this.loanNumber = `LOAN-${String(seq).padStart(5, '0')}`;
    }
    next();
  } catch (err) {
    next(err);
  }
});

export default mongoose.model('Loan', loanSchema);
