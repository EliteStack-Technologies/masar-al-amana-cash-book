import Capital from '../models/Capital.js';
import CapitalWithdrawal from '../models/CapitalWithdrawal.js';
import CapitalAccount from '../models/CapitalAccount.js';
import { asyncHandler } from '../middleware/error.js';
import { round2 } from '../utils/calc.js';

const EDITABLE = ['amount', 'entryDate', 'notes'];

/** Case-insensitive exact name match, so "rashid" finds "Rashid". */
const findAccountByName = (ownerId, name) =>
  CapitalAccount.findOne({ shopOwner: ownerId, name }).collation({ locale: 'en', strength: 2 });

/**
 * Capital is cash an owner or partner puts into the shop, so the partner is
 * picked from the capital accounts list. A name with no match opens a new
 * account on the spot - the add-capital screen asks for nothing else.
 */
export async function resolveAccount(body, ownerId, userId) {
  if (body.account) {
    const account = await CapitalAccount.findOne({ _id: body.account, shopOwner: ownerId });
    if (!account) throw Object.assign(new Error('Account not found'), { status: 404 });
    return account;
  }

  const name = String(body.partnerName || '').trim();
  if (!name) throw Object.assign(new Error('Choose an account or type a name'), { status: 400 });

  const existing = await findAccountByName(ownerId, name);
  if (existing) return existing;

  return CapitalAccount.create({
    shopOwner: ownerId,
    name,
    mobile: String(body.partnerMobile || '').trim(),
    createdBy: userId,
  });
}

/** The capital accounts list, for the add-capital picker. */
export const listAccounts = asyncHandler(async (req, res) => {
  const items = await CapitalAccount.find({ shopOwner: req.shopId })
    .collation({ locale: 'en', strength: 2 })
    .sort({ name: 1 })
    .lean();
  res.json({ items });
});

export function buildFilter(query, ownerId) {
  const filter = { shopOwner: ownerId };
  if (query.status === 'open' || query.status === 'closed') filter.status = query.status;

  if (query.from || query.to) {
    filter.entryDate = {};
    if (query.from) filter.entryDate.$gte = new Date(query.from);
    if (query.to) filter.entryDate.$lte = new Date(query.to);
  }

  const q = String(query.q || '').trim();
  if (q) {
    const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    filter.$or = [{ partnerName: rx }, { partnerMobile: rx }, { capitalNumber: rx }];
  }
  return filter;
}

/** Recomputes withdrawnAmount + status from a capital entry's withdrawals. */
async function refreshCapital(capital) {
  const [agg] = await CapitalWithdrawal.aggregate([
    { $match: { capital: capital._id } },
    { $group: { _id: null, total: { $sum: '$amount' } } },
  ]);
  const withdrawn = round2(agg?.total || 0);
  capital.withdrawnAmount = withdrawn;
  capital.status = withdrawn >= capital.amount ? 'closed' : 'open';
  await capital.save();
  return capital;
}

const withBalance = (c) => ({ ...c, balance: round2(Math.max(0, c.amount - c.withdrawnAmount)) });

export const listCapital = asyncHandler(async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
  const filter = buildFilter(req.query, req.shopId);

  const [items, total, totals, byAccount] = await Promise.all([
    Capital.find(filter).sort({ entryDate: -1, createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    Capital.countDocuments(filter),
    Capital.aggregate([
      { $match: filter },
      { $group: { _id: null, amount: { $sum: '$amount' }, withdrawn: { $sum: '$withdrawnAmount' } } },
    ]),
    // Account-wise position, so the capital screen can be read per partner.
    Capital.aggregate([
      { $match: { shopOwner: req.shopId } },
      { $sort: { entryDate: 1 } },
      {
        $group: {
          _id: '$account',
          name: { $last: '$partnerName' },
          invested: { $sum: '$amount' },
          withdrawn: { $sum: '$withdrawnAmount' },
          entries: { $sum: 1 },
          openEntries: { $sum: { $cond: [{ $eq: ['$status', 'open'] }, 1, 0] } },
          lastAt: { $max: '$entryDate' },
        },
      },
      { $sort: { invested: -1 } },
    ]),
  ]);

  const invested = round2(totals[0]?.amount || 0);
  const withdrawn = round2(totals[0]?.withdrawn || 0);
  res.json({
    items: items.map(withBalance),
    page,
    limit,
    total,
    pages: Math.ceil(total / limit) || 1,
    totals: { invested, withdrawn, balance: round2(Math.max(0, invested - withdrawn)) },
    byAccount: byAccount.map((r) => ({
      accountId: r._id,
      name: r.name,
      invested: round2(r.invested),
      withdrawn: round2(r.withdrawn),
      balance: round2(Math.max(0, r.invested - r.withdrawn)),
      entries: r.entries,
      openEntries: r.openEntries,
      lastAt: r.lastAt,
    })),
  });
});

/**
 * Everything the shop holds on one partner: every capital entry they have put
 * in, the withdrawals under each, and the combined position.
 */
export const accountCapital = asyncHandler(async (req, res) => {
  const account = await CapitalAccount.findOne({
    _id: req.params.accountId,
    shopOwner: req.shopId,
  }).lean();
  if (!account) return res.status(404).json({ message: 'Account not found' });

  const entries = await Capital.find({ shopOwner: req.shopId, account: account._id })
    .sort({ entryDate: -1, createdAt: -1 })
    .lean();

  const withdrawals = await CapitalWithdrawal.find({
    shopOwner: req.shopId,
    capital: { $in: entries.map((c) => c._id) },
  })
    .sort({ entryDate: -1, createdAt: -1 })
    .lean();

  // Hang each withdrawal under its own entry, keeping the sort above.
  const byEntry = new Map();
  withdrawals.forEach((w) => {
    const key = String(w.capital);
    if (!byEntry.has(key)) byEntry.set(key, []);
    byEntry.get(key).push(w);
  });

  const rows = entries.map((c) => ({ ...withBalance(c), withdrawals: byEntry.get(String(c._id)) || [] }));

  const invested = round2(rows.reduce((a, c) => a + c.amount, 0));
  const withdrawn = round2(rows.reduce((a, c) => a + c.withdrawnAmount, 0));
  const dates = rows.map((c) => new Date(c.entryDate).getTime()).filter(Boolean);

  res.json({
    account: {
      _id: account._id,
      accountNumber: account.accountNumber,
      name: account.name,
      mobile: account.mobile || '',
      notes: account.notes || '',
    },
    entries: rows,
    totals: {
      invested,
      withdrawn,
      balance: round2(Math.max(0, invested - withdrawn)),
      entries: rows.length,
      withdrawals: withdrawals.length,
      firstAt: dates.length ? new Date(Math.min(...dates)) : null,
      lastAt: dates.length ? new Date(Math.max(...dates)) : null,
    },
  });
});

export const getCapital = asyncHandler(async (req, res) => {
  const capital = await Capital.findOne({ _id: req.params.id, shopOwner: req.shopId });
  if (!capital) return res.status(404).json({ message: 'Capital entry not found' });

  const withdrawals = await CapitalWithdrawal.find({ capital: capital._id })
    .sort({ entryDate: -1, createdAt: -1 })
    .lean();

  res.json({ capital: capital.toJSON(), withdrawals });
});

export const createCapital = asyncHandler(async (req, res) => {
  const body = req.body || {};
  if (!(Number(body.amount) > 0)) {
    return res.status(400).json({ message: 'Capital amount must be greater than 0' });
  }

  const account = await resolveAccount(body, req.shopId, req.user._id);

  const payload = { shopOwner: req.shopId, createdBy: req.user._id };
  for (const key of EDITABLE) if (body[key] !== undefined) payload[key] = body[key];
  // Snapshot the account so renaming it never rewrites history.
  payload.account = account._id;
  payload.partnerName = account.name;
  payload.partnerMobile = account.mobile || '';

  const capital = await Capital.create(payload);
  res.status(201).json({ capital: capital.toJSON() });
});

export const updateCapital = asyncHandler(async (req, res) => {
  const capital = await Capital.findOne({ _id: req.params.id, shopOwner: req.shopId });
  if (!capital) return res.status(404).json({ message: 'Capital entry not found' });

  for (const key of EDITABLE) if (req.body[key] !== undefined) capital[key] = req.body[key];
  if (req.body.account !== undefined || req.body.partnerName !== undefined) {
    const account = await resolveAccount({ ...req.body }, req.shopId, req.user._id);
    capital.account = account._id;
    capital.partnerName = account.name;
    capital.partnerMobile = account.mobile || '';
  }
  capital.updatedBy = req.user._id;
  // The amount may have changed, so re-evaluate open/closed.
  capital.status = capital.withdrawnAmount >= capital.amount ? 'closed' : 'open';
  await capital.save();
  res.json({ capital: capital.toJSON() });
});

export const deleteCapital = asyncHandler(async (req, res) => {
  const capital = await Capital.findOneAndDelete({ _id: req.params.id, shopOwner: req.shopId });
  if (!capital) return res.status(404).json({ message: 'Capital entry not found' });
  await CapitalWithdrawal.deleteMany({ capital: capital._id });
  res.json({ message: `${capital.capitalNumber} deleted` });
});

/** Record cash a partner takes back out against a capital entry. */
export const addWithdrawal = asyncHandler(async (req, res) => {
  const capital = await Capital.findOne({ _id: req.params.id, shopOwner: req.shopId });
  if (!capital) return res.status(404).json({ message: 'Capital entry not found' });

  if (!(Number(req.body.amount) > 0)) {
    return res.status(400).json({ message: 'Withdrawal amount must be greater than 0' });
  }

  await CapitalWithdrawal.create({
    shopOwner: req.shopId,
    capital: capital._id,
    amount: Number(req.body.amount),
    entryDate: req.body.entryDate || Date.now(),
    notes: req.body.notes || '',
    createdBy: req.user._id,
  });

  await refreshCapital(capital);
  const withdrawals = await CapitalWithdrawal.find({ capital: capital._id })
    .sort({ entryDate: -1, createdAt: -1 })
    .lean();
  res.status(201).json({ capital: capital.toJSON(), withdrawals });
});

export const deleteWithdrawal = asyncHandler(async (req, res) => {
  const withdrawal = await CapitalWithdrawal.findOneAndDelete({
    _id: req.params.withdrawalId,
    capital: req.params.id,
    shopOwner: req.shopId,
  });
  if (!withdrawal) return res.status(404).json({ message: 'Withdrawal not found' });

  const capital = await Capital.findOne({ _id: req.params.id, shopOwner: req.shopId });
  if (capital) await refreshCapital(capital);
  res.json({ message: 'Withdrawal removed' });
});
