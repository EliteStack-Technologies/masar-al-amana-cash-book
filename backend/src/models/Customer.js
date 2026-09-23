import mongoose from 'mongoose';
import { nextSequence } from './Counter.js';

const customerSchema = new mongoose.Schema(
  {
    shopOwner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    custNumber: { type: String, unique: true, index: true },

    name: { type: String, required: true, trim: true, index: true },
    mobile: { type: String, default: '', trim: true, index: true },
    // Per-customer rate that pre-fills the New Transaction screen.
    commissionPercent: { type: Number, default: 3, min: 0, max: 100 },
    // The machine this customer usually swipes on (optional).
    machine: { type: mongoose.Schema.Types.ObjectId, ref: 'CardMachine', default: null, index: true },

    status: { type: String, enum: ['active', 'inactive'], default: 'active', index: true },
    notes: { type: String, default: '', trim: true },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

customerSchema.pre('validate', async function (next) {
  try {
    if (!this.custNumber) {
      const seq = await nextSequence('customer');
      this.custNumber = `CUST-${String(seq).padStart(5, '0')}`;
    }
    next();
  } catch (err) {
    next(err);
  }
});

export default mongoose.model('Customer', customerSchema);
