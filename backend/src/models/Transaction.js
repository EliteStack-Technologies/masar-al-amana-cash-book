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

    // --- what the owner types ---
    swipedAmount: { type: Number, required: true, min: 0 },
    // The rate charged to the customer, read against whichever amount was
    // typed - see commissionType.
    custPercent: { type: Number, default: 0, min: 0, max: 100 },
    // Which end the typed amount was: 'included' means it was the swipe and
    // the charge came out of it, 'excluded' means it was the customer's cash
    // and the charge went on top.
    commissionType: {
      type: String,
      enum: ['included', 'excluded'],
      default: 'included',
      index: true,
    },
    cardRefNumber: { type: String, default: '', trim: true, index: true },
    notes: { type: String, default: '', trim: true },

    // Snapshot of the machine's rate at entry time, so re-rating a machine
    // never rewrites old entries.
    supplierPercent: { type: Number, default: 0, min: 0, max: 100 },

    // --- derived by computeAmounts(), never sent by the client ---
    givenAmount: { type: Number, required: true },      // cash handed over
    chargeToCustomer: { type: Number, required: true }, // swiped - given
    supplierFee: { type: Number, required: true },      // swiped x supplier %
    supplierAccount: { type: Number, required: true },  // swiped - supplier fee
    margin: { type: Number, required: true },           // charge - supplier fee

    // --- settlement ---
    // What the company actually paid. Null until the money lands; banks round
    // down, so it is typed rather than assumed.
    settlementAmount: { type: Number, default: null },
    profit: { type: Number, default: null }, // settlement - given
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
    // givenAmount is already set on a re-save, so it stays the source of truth
    // and the maths is stable however many times the row is touched.
    Object.assign(this, computeAmounts(this));
    next();
  } catch (err) {
    next(err);
  }
});

export default mongoose.model('Transaction', transactionSchema);
