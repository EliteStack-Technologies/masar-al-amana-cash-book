import User from '../models/User.js';
import { asyncHandler } from '../middleware/error.js';
import { signToken, COOKIE_NAME, cookieOptions } from '../utils/token.js';

export const login = asyncHandler(async (req, res) => {
  const email = String(req.body.email || '').toLowerCase().trim();
  const password = String(req.body.password || '');

  if (!email || !password) {
    console.warn(`[auth] login rejected: missing ${!email ? 'email' : 'password'}`);
    return res.status(400).json({ message: 'Email and password are required' });
  }

  console.log(`[auth] login attempt ${email} (password length ${password.length})`);

  const user = await User.findOne({ email });
  // Same message either way so the form never reveals which emails exist;
  // the server log says which one it was.
  if (!user) {
    console.warn(`[auth] login failed ${email}: no such user`);
    return res.status(401).json({ message: 'Incorrect email or password' });
  }
  if (!user.passwordHash) {
    console.warn(`[auth] login failed ${email}: user has no password set (run npm run seed)`);
    return res.status(401).json({ message: 'Incorrect email or password' });
  }
  if (!(await user.verifyPassword(password))) {
    console.warn(`[auth] login failed ${email}: wrong password`);
    return res.status(401).json({ message: 'Incorrect email or password' });
  }

  console.log(`[auth] login ok ${email}`);
  res.cookie(COOKIE_NAME, signToken(user._id), cookieOptions());
  res.json({ user: user.toSafeJSON() });
});

export const logout = asyncHandler(async (req, res) => {
  res.clearCookie(COOKIE_NAME, { ...cookieOptions(), maxAge: undefined });
  res.json({ message: 'Signed out' });
});

export const me = asyncHandler(async (req, res) => {
  res.json({ user: req.user.toSafeJSON() });
});

export const updateProfile = asyncHandler(async (req, res) => {
  const { name, shopName, defaultCommissionPercent, defaultOwnerSharePercent } = req.body;
  const user = req.user;

  if (name !== undefined) user.name = String(name).trim();
  if (shopName !== undefined) user.shopName = String(shopName).trim();
  if (defaultCommissionPercent !== undefined) {
    user.defaultCommissionPercent = Number(defaultCommissionPercent);
  }
  if (defaultOwnerSharePercent !== undefined) {
    user.defaultOwnerSharePercent = Number(defaultOwnerSharePercent);
  }

  await user.save();
  res.json({ user: user.toSafeJSON() });
});

export const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (!newPassword || String(newPassword).length < 6) {
    return res.status(400).json({ message: 'New password must be at least 6 characters' });
  }
  if (!(await req.user.verifyPassword(String(currentPassword || '')))) {
    return res.status(401).json({ message: 'Current password is incorrect' });
  }

  await req.user.setPassword(String(newPassword));
  await req.user.save();
  res.json({ message: 'Password updated' });
});
