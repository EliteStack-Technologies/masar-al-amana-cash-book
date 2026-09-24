import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { COOKIE_NAME } from '../utils/token.js';
import { SHOP_ID } from '../shop.js';

export async function requireAuth(req, res, next) {
  try {
    const bearer = req.headers.authorization?.startsWith('Bearer ')
      ? req.headers.authorization.slice(7)
      : null;
    const token = req.cookies?.[COOKIE_NAME] || bearer;

    if (!token) return res.status(401).json({ message: 'Not signed in' });

    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(payload.sub);
    if (!user) return res.status(401).json({ message: 'Account no longer exists' });

    req.user = user;
    // Both logins share one shop; scope data by this, not by req.user.
    req.shopId = SHOP_ID;
    next();
  } catch {
    res.status(401).json({ message: 'Session expired, please sign in again' });
  }
}
