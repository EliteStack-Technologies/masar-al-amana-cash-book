import mongoose from 'mongoose';

// One managed list of category names, shared by income and expense entries.
// `kind` keeps the two lists apart.
const categorySchema = new mongoose.Schema(
  {
    shopOwner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    kind: { type: String, enum: ['income', 'expense'], required: true, index: true },
    name: { type: String, required: true, trim: true },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

// A shop owner can't have the same category name twice within one kind.
categorySchema.index({ shopOwner: 1, kind: 1, name: 1 }, { unique: true });

export default mongoose.model('Category', categorySchema);
