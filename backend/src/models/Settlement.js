import mongoose from 'mongoose';

// One day's settlement in a single record: the owner marks a report day as
// received, noting how much the card company actually paid and why. Every
// pending transaction on that day is flipped to received and linked here.
const settlementSchema = new mongoose.Schema(
  {
    shopOwner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    settleDate: { type: String, required: true, index: true }, // YYYY-MM-DD (report day)

    expectedAmount: { type: Number, required: true }, // sum of settlementAmount of the entries
    receivedAmount: { type: Number, required: true }, // what the company actually paid
    txnCount: { type: Number, required: true },
    note: { type: String, default: '', trim: true },
    receivedAt: { type: Date, default: Date.now },

    // Set on a vendor (machine-wise) settlement. Its entries settle at what
    // they were owed, and any gap between what the company paid and that is
    // kept here, on the machine's running ledger, instead of in swipe profit.
    // Paid 2,000 for 1,995 -> +5 (paid extra); 2,000 for 2,002 -> -2 (short).
    machine: { type: mongoose.Schema.Types.ObjectId, ref: 'CardMachine', default: null, index: true },
    difference: { type: Number, default: 0 },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

settlementSchema.index({ shopOwner: 1, settleDate: 1 });

export default mongoose.model('Settlement', settlementSchema);
