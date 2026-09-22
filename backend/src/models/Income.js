import mongoose from 'mongoose';
import { nextSequence } from './Counter.js';

const incomeSchema = new mongoose.Schema(
  {
    shopOwner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    incomeNumber: { type: String, unique: true, index: true },

    entryDate: { type: Date, default: Date.now, index: true },
    amount: { type: Number, required: true, min: 0 },
    // Category name is snapshotted so renaming/deleting a Category never
    // rewrites history.
    category: { type: String, default: '', trim: true, index: true },
    receiver: { type: String, default: '', trim: true }, // received from
    notes: { type: String, default: '', trim: true },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

incomeSchema.index({ entryDate: -1 });

incomeSchema.pre('validate', async function (next) {
  try {
    if (!this.incomeNumber) {
      const seq = await nextSequence('income');
      this.incomeNumber = `INC-${String(seq).padStart(5, '0')}`;
    }
    next();
  } catch (err) {
    next(err);
  }
});

export default mongoose.model('Income', incomeSchema);
