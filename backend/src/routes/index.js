import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import * as auth from '../controllers/authController.js';
import * as txn from '../controllers/transactionController.js';
import * as report from '../controllers/reportController.js';
import * as xport from '../controllers/exportController.js';
import * as customer from '../controllers/customerController.js';
import * as machine from '../controllers/cardMachineController.js';
import * as category from '../controllers/categoryController.js';
import * as income from '../controllers/incomeController.js';
import * as expense from '../controllers/expenseController.js';
import * as loan from '../controllers/loanController.js';
import * as capital from '../controllers/capitalController.js';
import * as settlement from '../controllers/settlementController.js';
import * as cashbook from '../controllers/cashbookController.js';
import * as opening from '../controllers/openingBalanceController.js';
import * as pl from '../controllers/plController.js';

const router = Router();

router.get('/health', (req, res) => res.json({ ok: true, at: new Date().toISOString() }));

// --- auth ---
router.post('/auth/login', auth.login);
router.post('/auth/logout', auth.logout);
router.get('/auth/me', requireAuth, auth.me);
router.patch('/auth/profile', requireAuth, auth.updateProfile);
router.post('/auth/change-password', requireAuth, auth.changePassword);

// Everything below needs a signed-in shop owner.
router.use(requireAuth);

// --- transactions ---
router.get('/transactions', txn.listTransactions);
router.post('/transactions', txn.createTransaction);
router.post('/transactions/bulk-settle', txn.bulkSettle);
router.get('/transactions/:id', txn.getTransaction);
router.patch('/transactions/:id', txn.updateTransaction);
router.patch('/transactions/:id/settlement', txn.setSettlement);
router.delete('/transactions/:id', txn.deleteTransaction);

// --- customers ---
router.get('/customers', customer.listCustomers);
router.post('/customers', customer.createCustomer);
router.get('/customers/:id', customer.getCustomer);
router.patch('/customers/:id', customer.updateCustomer);
router.delete('/customers/:id', customer.deleteCustomer);

// --- card machines ---
router.get('/machines', machine.listMachines);
router.post('/machines', machine.createMachine);
router.get('/machines/:id', machine.getMachine);
router.patch('/machines/:id', machine.updateMachine);
router.delete('/machines/:id', machine.deleteMachine);

// --- categories (income + expense) ---
router.get('/categories', category.listCategories);
router.post('/categories', category.createCategory);
router.patch('/categories/:id', category.updateCategory);
router.delete('/categories/:id', category.deleteCategory);

// --- income ---
router.get('/income', income.listIncome);
router.post('/income', income.createIncome);
router.get('/income/:id', income.getIncome);
router.patch('/income/:id', income.updateIncome);
router.delete('/income/:id', income.deleteIncome);

// --- expenses ---
router.get('/expenses', expense.listExpenses);
router.post('/expenses', expense.createExpense);
router.get('/expenses/:id', expense.getExpense);
router.patch('/expenses/:id', expense.updateExpense);
router.delete('/expenses/:id', expense.deleteExpense);

// --- loans + loan settlements ---
router.get('/loans', loan.listLoans);
router.post('/loans', loan.createLoan);
// Registered before '/loans/:id' so 'accounts' is never read as a loan id.
router.get('/loans/accounts', loan.listAccounts);
// Two segments, so this never collides with '/loans/:id'.
router.get('/loans/account/:accountId', loan.accountLoans);
router.get('/loans/:id', loan.getLoan);
router.patch('/loans/:id', loan.updateLoan);
router.delete('/loans/:id', loan.deleteLoan);
router.post('/loans/:id/settlements', loan.addSettlement);
router.delete('/loans/:id/settlements/:settlementId', loan.deleteSettlement);

// --- capital + withdrawals ---
router.get('/capital', capital.listCapital);
router.post('/capital', capital.createCapital);
// Registered before '/capital/:id' so 'accounts' is never read as an id.
router.get('/capital/accounts', capital.listAccounts);
router.get('/capital/account/:accountId', capital.accountCapital);
router.get('/capital/:id', capital.getCapital);
router.patch('/capital/:id', capital.updateCapital);
router.delete('/capital/:id', capital.deleteCapital);
router.post('/capital/:id/withdrawals', capital.addWithdrawal);
router.delete('/capital/:id/withdrawals/:withdrawalId', capital.deleteWithdrawal);

// --- profit & loss + profit shared out to partners ---
router.get('/pl', pl.plReport);
router.post('/pl/settlements', pl.createProfitSettlement);
router.delete('/pl/settlements/:id', pl.deleteProfitSettlement);

// --- day-level settlement ---
router.get('/settlements/day', settlement.listSettlements);
router.post('/settlements/day', settlement.settleDay);
// Reverts vendor (machine-wise) settlements too: both are Settlement batches.
router.delete('/settlements/day/:id', settlement.revertDay);

// --- vendor (machine-wise) settlement + ledger ---
router.get('/settlements/vendors', settlement.listVendors);
router.get('/settlements/vendors/:machineId', settlement.vendorLedger);
router.post('/settlements/vendors/:machineId', settlement.settleVendor);

// --- cash book (every entry in one ledger) ---
router.get('/cashbook', cashbook.cashbook);
router.get('/cashbook/opening', opening.listOpening);
router.post('/cashbook/opening', opening.createOpening);
router.patch('/cashbook/opening/:id', opening.updateOpening);
router.delete('/cashbook/opening/:id', opening.deleteOpening);

// --- reports ---
router.get('/reports/dashboard', report.dashboard);
router.get('/reports/daily', report.dailyReport);
router.get('/reports/weekly', report.weeklyReport);
router.get('/reports/monthly', report.monthlyReport);
router.get('/reports/commission', report.commissionReport);
router.get('/reports/settlement', report.settlementReport);
router.get('/reports/customers', report.customerReport);
router.get('/reports/machines', report.machineReport);
// One machine by day, week or month: ?period=daily|weekly|monthly&date=YYYY-MM-DD
router.get('/reports/machines/:id', report.machinePeriodReport);

// --- exports ---
router.get('/export/excel', xport.exportExcel);
router.get('/export/pdf', xport.exportPdf);

export default router;
