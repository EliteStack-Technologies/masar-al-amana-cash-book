import User from './models/User.js';

/**
 * The two shop-owner logins. backend/.env can override any of these; the
 * fallbacks are the shop's default accounts.
 */
export function ownerAccounts() {
  return [
    {
      name: process.env.OWNER1_NAME || 'Shop Owner 1',
      email: process.env.OWNER1_EMAIL || 'owner1@masaralamana.ae',
      password: process.env.OWNER1_PASSWORD || '123456',
    },
    {
      name: process.env.OWNER2_NAME || 'Shop Owner 2',
      email: process.env.OWNER2_EMAIL || 'owner2@masaralamana.ae',
      password: process.env.OWNER2_PASSWORD || '123456',
    },
  ];
}

/**
 * Creates any owner login that does not exist yet. With `resetPasswords`,
 * existing logins also get their name and password reset to the configured
 * ones (what `npm run seed` does); without it they are left alone, so a
 * password changed in the app survives a restart or deploy.
 */
export async function ensureOwners({ resetPasswords = false, log = console.log } = {}) {
  for (const acc of ownerAccounts()) {
    const email = acc.email.toLowerCase().trim();
    const user = await User.findOne({ email });

    if (!user) {
      const created = new User({ name: acc.name, email });
      await created.setPassword(acc.password);
      await created.save();
      log(`[owners] created ${email}`);
    } else if (resetPasswords) {
      user.name = acc.name;
      await user.setPassword(acc.password);
      await user.save();
      log(`[owners] updated password for ${email}`);
    }
  }
}
