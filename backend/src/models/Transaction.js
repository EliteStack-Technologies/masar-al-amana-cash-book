import mongoose from 'mongoose';
import { nextSequence } from './Counter.js';
import { computeAmounts } from '../utils/calc.js';

const transactionSchema = new mongoose.Schema(
  {
    txnNumber: { type: String, unique: true, index: true },
    txnDate: { type: Date, default: Date.now, index: true },

    shopOwner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },

    // --- the machine this entry belongs to (customer is optional) ---
    machine: { type: mongoose.Schema.Types.ObjectId, ref: 'CardMachine', required: true, index: true },
    customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', default: null, index: true },

    // Snapshots (from the chosen customer, or typed in for a walk-in) so
    // reports and exports stay correct even if a customer record changes.
    customerMobile: { type: String, default: '', trim: true, index: true },
    customerName: { type: String, default: '', trim: true },
    requestedAmount: { type: Number, required: true, min: 0 },
    commissionPercent: { type: Number, required: true, min: 0, max: 100 },
    commissionType: {
      type: String,
      enum: ['included', 'excluded'],
      required: true,
    },
    ownerSharePercent: { type: Number, default: 50, min: 0, max: 100 },
    cardRefNumber: { type: String, default: '', trim: true, index: true },
    notes: { type: String, default: '', trim: true },

    // --- derived by computeAmounts(), never sent by the client ---
    commissionAmount: { type: Number, required: true },
    customerReceived: { type: Number, required: true },
    cardAmount: { type: Number, required: true },
    ownerCommission: { type: Number, required: true },
    companyCommission: { type: Number, required: true },
    settlementAmount: { type: Number, required: true },

    // --- settlement ---
    settlementStatus: {
      type: String,
      enum: ['pending', 'received'],
      default: 'pending',
      index: true,
    },
    receivedAt: { type: Date, default: null },
    // Set when the day is settled in one action from the Daily Report.
    settlementNote: { type: String, default: '', trim: true },
    settlementBatch: { type: mongoose.Schema.Types.ObjectId, ref: 'Settlement', default: null, index: true },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

// Common list query: newest first, optionally narrowed by status.
transactionSchema.index({ txnDate: -1 });
transactionSchema.index({ settlementStatus: 1, txnDate: -1 });

transactionSchema.pre('validate', async function (next) {
  try {
    if (!this.txnNumber) {
      const seq = await nextSequence('transaction');
      this.txnNumber = `TXN-${String(seq).padStart(6, '0')}`;
    }
    Object.assign(this, computeAmounts(this));
    next();
  } catch (err) {
    next(err);
  }
});

export default mongoose.model('Transaction', transactionSchema);
