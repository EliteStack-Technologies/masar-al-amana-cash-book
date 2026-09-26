import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    passwordHash: { type: String, required: true },
    shopName: { type: String, default: 'My Shop', trim: true },
    // Prefills the customer's rate on the new-transaction form.
    defaultCommissionPercent: { type: Number, default: 0, min: 0, max: 100 },
    // Which OWNER_SEED_VERSION (src/owners.js) last set this login's password.
    seedVersion: { type: Number },
  },
  { timestamps: true }
);

userSchema.methods.setPassword = async function (plain) {
  this.passwordHash = await bcrypt.hash(plain, 10);
};

userSchema.methods.verifyPassword = async function (plain) {
  // A user written outside the app (e.g. by hand in mongosh) may have no hash;
  // that is a failed sign-in, not a server error. `npm run seed` sets one.
  if (!this.passwordHash) return false;
  return bcrypt.compare(plain, this.passwordHash);
};

userSchema.methods.toSafeJSON = function () {
  return {
    id: this._id,
    name: this.name,
    email: this.email,
    shopName: this.shopName,
    defaultCommissionPercent: this.defaultCommissionPercent,
  };
};

export default mongoose.model('User', userSchema);
