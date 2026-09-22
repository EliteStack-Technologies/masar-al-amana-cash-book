import mongoose from 'mongoose';
import { nextSequence } from './Counter.js';

const expenseSchema = new mongoose.Schema(
  {
    shopOwner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    expenseNumber: { type: String, unique: true, index: true },

    entryDate: { type: Date, default: Date.now, index: true },
    amount: { type: Number, required: true, min: 0 },
    category: { type: String, default: '', trim: true, index: true },
    payee: { type: String, default: '', trim: true }, // paid to
    notes: { type: String, default: '', trim: true },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

expenseSchema.index({ entryDate: -1 });

expenseSchema.pre('validate', async function (next) {
  try {
    if (!this.expenseNumber) {
      const seq = await nextSequence('expense');
      this.expenseNumber = `EXP-${String(seq).padStart(5, '0')}`;
    }
    next();
  } catch (err) {
    next(err);
  }
});

export default mongoose.model('Expense', expenseSchema);
