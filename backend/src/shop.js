import mongoose from 'mongoose';
import Capital from './models/Capital.js';
import CapitalAccount from './models/CapitalAccount.js';
import CapitalWithdrawal from './models/CapitalWithdrawal.js';
import CardMachine from './models/CardMachine.js';
import Category from './models/Category.js';
import Counter from './models/Counter.js';
import Customer from './models/Customer.js';
import Expense from './models/Expense.js';
import Income from './models/Income.js';
import Loan from './models/Loan.js';
import LoanAccount from './models/LoanAccount.js';
import LoanSettlement from './models/LoanSettlement.js';
import OpeningBalance from './models/OpeningBalance.js';
import Settlement from './models/Settlement.js';
import Transaction from './models/Transaction.js';
import User from './models/User.js';

/**
 * The one shop both owner logins work in. Every record's `shopOwner` is this
 * id rather than a user's, so the logins share all data, and replacing a
 * login (src/owners.js) never hides what was entered under the old one.
 */
export const SHOP_ID = new mongoose.Types.ObjectId('5ca5b00c0000000000000001');

const MODELS = [
  Capital, CapitalAccount, CapitalWithdrawal, CardMachine, Customer, Expense, Income, Loan, LoanAccount,
  LoanSettlement, OpeningBalance, Settlement, Transaction,
];

/**
 * The charge-to-customer % used to default to 2.9 on logins and customers,
 * and neither screen lets it be changed any more. Once, set every 2.9 still
 * sitting there to the new default of 0; a marker in the counters collection
 * keeps it from running again, so a rate set later is never touched.
 */
export async function zeroOldDefaultRates({ log = console.log } = {}) {
  const MARK = 'migration:zero-default-rate';
  if (await Counter.exists({ _id: MARK })) return;

  const users = await User.updateMany({ defaultCommissionPercent: 2.9 }, { $set: { defaultCommissionPercent: 0 } });
  const customers = await Customer.updateMany({ commissionPercent: 2.9 }, { $set: { commissionPercent: 0 } });
  await Counter.create({ _id: MARK, seq: 1 });
  log(`[shop] default charge % 2.9 -> 0 on ${users.modifiedCount} login(s), ${customers.modifiedCount} customer(s)`);
}

/**
 * Moves records still keyed to an individual login onto the shop. Runs on
 * every start; once everything is moved it finds nothing to do.
 */
export async function adoptShopData({ log = console.log } = {}) {
  const others = { shopOwner: { $ne: SHOP_ID } };

  // Category names are unique per shop, so a name both logins had is kept
  // once. Entries store the name itself, so dropping the duplicate is safe.
  let categories = 0;
  for (const cat of await Category.find(others)) {
    const exists = await Category.exists({ shopOwner: SHOP_ID, kind: cat.kind, name: cat.name });
    if (exists) await cat.deleteOne();
    else await Category.updateOne({ _id: cat._id }, { $set: { shopOwner: SHOP_ID } });
    categories += 1;
  }
  if (categories) log(`[shop] moved ${categories} categor${categories === 1 ? 'y' : 'ies'} to the shared shop`);

  for (const Model of MODELS) {
    const { modifiedCount } = await Model.updateMany(others, { $set: { shopOwner: SHOP_ID } });
    if (modifiedCount) log(`[shop] moved ${modifiedCount} ${Model.modelName} record(s) to the shared shop`);
  }
}
