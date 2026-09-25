import mongoose from 'mongoose';
import { nextSequence } from './Counter.js';

const loanSchema = new mongoose.Schema(
  {
    shopOwner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    loanNumber: { type: String, unique: true, index: true },

    // payable: the account lent the shop cash (in), the shop pays it back.
    // receivable: the shop lent the account cash (out), they pay it back.
    // Loans from before this field existed have none and read as payable.
    direction: { type: String, enum: ['payable', 'receivable'], default: 'payable', index: true },

    // Who put the cash in, from the loan accounts list; the name is
    // snapshotted so renaming an account never rewrites loan history.
    account: { type: mongoose.Schema.Types.ObjectId, ref: 'LoanAccount', default: null, index: true },
    // Legacy: loans used to be taken against a swipe customer. Kept so old
    // rows can be moved onto an account; nothing new is written here.
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

export const DIRECTIONS = ['payable', 'receivable'];

/** Match for one direction; older rows without the field count as payable. */
export const directionMatch = (direction) =>
  direction === 'receivable' ? { direction: 'receivable' } : { direction: { $ne: 'receivable' } };

export default mongoose.model('Loan', loanSchema);
