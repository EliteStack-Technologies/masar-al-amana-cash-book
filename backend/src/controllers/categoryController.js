import Category from '../models/Category.js';
import { asyncHandler } from '../middleware/error.js';

const KINDS = ['income', 'expense'];

export const listCategories = asyncHandler(async (req, res) => {
  const filter = { shopOwner: req.shopId };
  if (KINDS.includes(req.query.kind)) filter.kind = req.query.kind;

  const items = await Category.find(filter).sort({ kind: 1, name: 1 }).lean();
  res.json({ items });
});

export const createCategory = asyncHandler(async (req, res) => {
  const { name, kind } = req.body || {};
  if (!KINDS.includes(kind)) {
    return res.status(400).json({ message: 'Category kind must be income or expense' });
  }
  if (!name || !String(name).trim()) {
    return res.status(400).json({ message: 'Category name is required' });
  }
  const category = await Category.create({
    shopOwner: req.shopId,
    createdBy: req.user._id,
    kind,
    name: String(name).trim(),
  });
  res.status(201).json({ category });
});

export const updateCategory = asyncHandler(async (req, res) => {
  const category = await Category.findOne({ _id: req.params.id, shopOwner: req.shopId });
  if (!category) return res.status(404).json({ message: 'Category not found' });
  if (req.body.name !== undefined) category.name = String(req.body.name).trim();
  await category.save();
  res.json({ category });
});

export const deleteCategory = asyncHandler(async (req, res) => {
  const category = await Category.findOneAndDelete({ _id: req.params.id, shopOwner: req.shopId });
  if (!category) return res.status(404).json({ message: 'Category not found' });
  res.json({ message: `${category.name} deleted` });
});
