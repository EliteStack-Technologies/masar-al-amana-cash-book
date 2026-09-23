import mongoose from 'mongoose';

import { nextSequence } from './Counter.js';

const cardMachineSchema = new mongoose.Schema(
  {
    shopOwner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    machineNumber: { type: String, unique: true, index: true },

    name: { type: String, required: true, trim: true, index: true },
    // The owner's own label/serial for the physical machine.
    deviceId: { type: String, default: '', trim: true },
    cardCompany: { type: String, default: '', trim: true },
    // The card company's cut of every swipe on this machine. Set once when
    // the machine is added; each transaction snapshots it at entry time.
    supplierPercent: { type: Number, default: 0, min: 0, max: 100 },

    status: { type: String, enum: ['active', 'inactive'], default: 'active', index: true },
    notes: { type: String, default: '', trim: true },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

cardMachineSchema.pre('validate', async function (next) {
  try {
    if (!this.machineNumber) {
      const seq = await nextSequence('cardMachine');
      this.machineNumber = `MC-${String(seq).padStart(4, '0')}`;
    }
    next();
  } catch (err) {
    next(err);
  }
});

export default mongoose.model('CardMachine', cardMachineSchema);
