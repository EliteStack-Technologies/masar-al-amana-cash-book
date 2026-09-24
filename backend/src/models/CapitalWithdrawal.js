import mongoose from 'mongoose';

// Cash a partner takes back out against a Capital entry. The parent's
// withdrawnAmount/status are kept up to date by capitalController whenever one
// of these is added or removed.
const capitalWithdrawalSchema = new mongoose.Schema(
  {
    shopOwner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    capital: { type: mongoose.Schema.Types.ObjectId, ref: 'Capital', required: true, index: true },

    amount: { type: Number, required: true, min: 0 },
    entryDate: { type: Date, default: Date.now, index: true },
    notes: { type: String, default: '', trim: true },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

export default mongoose.model('CapitalWithdrawal', capitalWithdrawalSchema);
