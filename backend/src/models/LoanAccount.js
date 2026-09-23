import mongoose from 'mongoose';
import { nextSequence } from './Counter.js';

/**
 * Who a loan came from. Loan accounts are their own list, kept apart from the
 * swipe customers: a lender never shows up in Customers, and a swipe customer
 * never shows up in the loan picker.
 */
const loanAccountSchema = new mongoose.Schema(
  {
    shopOwner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    accountNumber: { type: String, unique: true, index: true },

    name: { type: String, required: true, trim: true, index: true },
    mobile: { type: String, default: '', trim: true },
    notes: { type: String, default: '', trim: true },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

loanAccountSchema.pre('validate', async function (next) {
  try {
    if (!this.accountNumber) {
      const seq = await nextSequence('loanAccount');
      this.accountNumber = `ACC-${String(seq).padStart(5, '0')}`;
    }
    next();
  } catch (err) {
    next(err);
  }
});

export default mongoose.model('LoanAccount', loanAccountSchema);
