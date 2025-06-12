const Expense = require('../models/Expense');

// Create expense (admin only)
exports.createExpense = async (req, res) => {
    try {
        const expense = new Expense({
            ...req.body,
            user_id: req.user._id
        });
        await expense.save();
        res.status(201).json(expense);
    } catch (error) {
        res.status(400).json({ error: 'Error creating expense' });
    }
};

// Get all expenses (admin only)
exports.getAllExpenses = async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        let query = {};

        if (startDate && endDate) {
            query.expense_date = {
                $gte: new Date(startDate),
                $lte: new Date(endDate)
            };
        }

        const expenses = await Expense.find(query)
            .populate('user_id', 'username')
            .sort({ expense_date: -1 });
        
        res.json(expenses);
    } catch (error) {
        res.status(500).json({ error: 'Error fetching expenses' });
    }
};

// Update expense (admin only)
exports.updateExpense = async (req, res) => {
    try {
        const expense = await Expense.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true, runValidators: true }
        );
        if (!expense) {
            return res.status(404).json({ error: 'Expense not found' });
        }
        res.json(expense);
    } catch (error) {
        res.status(400).json({ error: 'Error updating expense' });
    }
};

// Delete expense (admin only)
exports.deleteExpense = async (req, res) => {
    try {
        const expense = await Expense.findByIdAndDelete(req.params.id);
        if (!expense) {
            return res.status(404).json({ error: 'Expense not found' });
        }
        res.json({ message: 'Expense deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Error deleting expense' });
    }
};
