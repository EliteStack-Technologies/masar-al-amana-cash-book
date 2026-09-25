import mongoose from 'mongoose';

// A repayment against a Loan: paid out by the shop on a payable loan,
// collected by the shop on a receivable one. The parent Loan's settledAmount/status are kept
// up to date by loanController whenever one of these is added or removed.
const loanSettlementSchema = new mongoose.Schema(
  {
    shopOwner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    loan: { type: mongoose.Schema.Types.ObjectId, ref: 'Loan', required: true, index: true },
    // Copied from the loan so cash totals need no lookup; kept in step when
    // the loan's direction is edited. Missing on older rows = payable.
    direction: { type: String, enum: ['payable', 'receivable'], default: 'payable', index: true },

    amount: { type: Number, required: true, min: 0 },
    entryDate: { type: Date, default: Date.now, index: true },
    notes: { type: String, default: '', trim: true },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

export default mongoose.model('LoanSettlement', loanSettlementSchema);
