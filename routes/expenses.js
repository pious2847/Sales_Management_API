const express = require('express');
const router = express.Router();
const expenseController = require('../controllers/expenseController');
const auth = require('../middleware/auth');
const adminAuth = require('../middleware/adminAuth');

// Create expense (admin only)
router.post('/', auth, adminAuth, expenseController.createExpense);

// Get all expenses (admin only)
router.get('/', auth, adminAuth, expenseController.getAllExpenses);

// Update expense (admin only)
router.put('/:id', auth, adminAuth, expenseController.updateExpense);

// Delete expense (admin only)
router.delete('/:id', auth, adminAuth, expenseController.deleteExpense);

module.exports = router;
