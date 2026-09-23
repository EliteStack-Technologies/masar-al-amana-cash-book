import User from './models/User.js';

/** The shop's only two logins. The API makes sure they exist on every start. */
export const OWNER_ACCOUNTS = [
  { name: 'Shop Owner 1', email: 'owner1@masaralamana.ae', password: '123456' },
  { name: 'Shop Owner 2', email: 'owner2@masaralamana.ae', password: '123456' },
];

/**
 * Bump this to force both passwords back to the ones above on the next start
 * or deploy. Until it changes, a password changed in the app is kept.
 */
export const OWNER_SEED_VERSION = 1;

/**
 * Makes the database hold exactly the two owner logins: removes any other
 * user, creates a missing owner, and resets an owner's password once per
 * OWNER_SEED_VERSION. With `resetPasswords`, resets them regardless.
 */
export async function ensureOwners({ resetPasswords = false, log = console.log } = {}) {
  const emails = OWNER_ACCOUNTS.map((a) => a.email);
  log(`[owners] configured: ${emails.join(', ')}`);

  const removed = await User.deleteMany({ email: { $nin: emails } });
  if (removed.deletedCount) log(`[owners] removed ${removed.deletedCount} other user(s)`);

  for (const acc of OWNER_ACCOUNTS) {
    const user = await User.findOne({ email: acc.email });

    if (!user) {
      const created = new User({ name: acc.name, email: acc.email, seedVersion: OWNER_SEED_VERSION });
      await created.setPassword(acc.password);
      await created.save();
      log(`[owners] created ${acc.email}`);
    } else if (resetPasswords || user.seedVersion !== OWNER_SEED_VERSION) {
      await user.setPassword(acc.password);
      user.seedVersion = OWNER_SEED_VERSION;
      await user.save();
      log(`[owners] reset password for ${acc.email}`);
    } else {
      log(`[owners] ${acc.email} already set up - password left unchanged`);
    }
  }
}
