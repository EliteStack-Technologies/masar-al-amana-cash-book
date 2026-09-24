import mongoose from 'mongoose';
import { nextSequence } from './Counter.js';

/**
 * Who put capital into the shop (an owner or partner). Capital accounts are
 * their own list, kept apart from loan accounts and swipe customers.
 */
const capitalAccountSchema = new mongoose.Schema(
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

capitalAccountSchema.pre('validate', async function (next) {
  try {
    if (!this.accountNumber) {
      const seq = await nextSequence('capitalAccount');
      this.accountNumber = `CACC-${String(seq).padStart(5, '0')}`;
    }
    next();
  } catch (err) {
    next(err);
  }
});

export default mongoose.model('CapitalAccount', capitalAccountSchema);
