const Expense = require('../models/Expense');

// Create expense (admin only)
exports.createExpense = async (req, res) => {
    try {
        console.log('Creating expense with data:', req.body);
        
        const expense = new Expense({
            ...req.body,
            user_id: req.user._id
        });
        
        console.log('Expense model instance:', expense);
        
        await expense.save();
        console.log('Expense saved successfully:', expense);
        
        res.status(201).json(expense);
    } catch (error) {
        console.error('Error creating expense:', error);
        res.status(400).json({ error: 'Error creating expense: ' + error.message });
    }
};

// Get all expenses (admin only)
exports.getAllExpenses = async (req, res) => {
    try {
        console.log('Fetching expenses with query:', req.query);
        
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
        
        console.log(`Found ${expenses.length} expenses`);
        res.json(expenses);
    } catch (error) {
        console.error('Error fetching expenses:', error);
        res.status(500).json({ error: 'Error fetching expenses: ' + error.message });
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

// Get expense statistics
exports.getExpenseStats = async (req, res) => {
    try {
        const { period = 'month' } = req.query;
        
        let dateFilter = {};
        const now = new Date();
        
        switch (period) {
            case 'week':
                dateFilter = {
                    $gte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
                };
                break;
            case 'month':
                dateFilter = {
                    $gte: new Date(now.getFullYear(), now.getMonth(), 1)
                };
                break;
            case 'quarter':
                const quarterStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
                dateFilter = { $gte: quarterStart };
                break;
            case 'year':
                dateFilter = {
                    $gte: new Date(now.getFullYear(), 0, 1)
                };
                break;
        }

        const [totalExpenses, expenseCount] = await Promise.all([
            Expense.aggregate([
                { $match: { expense_date: dateFilter } },
                { $group: { _id: null, total: { $sum: '$amount' } } }
            ]),
            Expense.countDocuments({ expense_date: dateFilter })
        ]);

        // Get previous period for comparison
        let previousDateFilter = {};
        switch (period) {
            case 'week':
                previousDateFilter = {
                    $gte: new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000),
                    $lt: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
                };
                break;
            case 'month':
                previousDateFilter = {
                    $gte: new Date(now.getFullYear(), now.getMonth() - 1, 1),
                    $lt: new Date(now.getFullYear(), now.getMonth(), 1)
                };
                break;
            case 'quarter':
                const prevQuarterStart = new Date(now.getFullYear(), Math.floor((now.getMonth() - 3) / 3) * 3, 1);
                const currentQuarterStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
                previousDateFilter = {
                    $gte: prevQuarterStart,
                    $lt: currentQuarterStart
                };
                break;
            case 'year':
                previousDateFilter = {
                    $gte: new Date(now.getFullYear() - 1, 0, 1),
                    $lt: new Date(now.getFullYear(), 0, 1)
                };
                break;
        }

        const [previousTotalExpenses] = await Promise.all([
            Expense.aggregate([
                { $match: { expense_date: previousDateFilter } },
                { $group: { _id: null, total: { $sum: '$amount' } } }
            ])
        ]);

        const currentTotal = totalExpenses[0]?.total || 0;
        const previousTotal = previousTotalExpenses[0]?.total || 0;
        const growthPercentage = previousTotal > 0 
            ? ((currentTotal - previousTotal) / previousTotal) * 100 
            : 0;

        res.json({
            total: currentTotal,
            count: expenseCount,
            growth: Math.round(growthPercentage * 100) / 100,
            period
        });
    } catch (error) {
        console.error('Expense stats error:', error);
        res.status(500).json({ error: 'Error fetching expense statistics' });
    }
};

// Get expense analytics
exports.getExpenseAnalytics = async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        let dateFilter = {};

        if (startDate && endDate) {
            dateFilter = {
                expense_date: {
                    $gte: new Date(startDate),
                    $lte: new Date(endDate)
                }
            };
        }

        // Get daily expense data
        const dailyExpenses = await Expense.aggregate([
            { $match: dateFilter },
            {
                $group: {
                    _id: {
                        year: { $year: '$expense_date' },
                        month: { $month: '$expense_date' },
                        day: { $dayOfMonth: '$expense_date' }
                    },
                    total: { $sum: '$amount' },
                    count: { $sum: 1 }
                }
            },
            { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } }
        ]);

        // Get expenses by category
        const expensesByCategory = await Expense.aggregate([
            { $match: dateFilter },
            {
                $group: {
                    _id: '$category',
                    totalAmount: { $sum: '$amount' },
                    count: { $sum: 1 }
                }
            },
            { $sort: { totalAmount: -1 } }
        ]);

        // Get top expense categories
        const topCategories = await Expense.aggregate([
            { $match: dateFilter },
            {
                $group: {
                    _id: '$category',
                    totalAmount: { $sum: '$amount' },
                    count: { $sum: 1 },
                    avgAmount: { $avg: '$amount' }
                }
            },
            { $sort: { totalAmount: -1 } },
            { $limit: 10 }
        ]);

        res.json({
            dailyExpenses: dailyExpenses.map(item => ({
                date: `${item._id.year}-${String(item._id.month).padStart(2, '0')}-${String(item._id.day).padStart(2, '0')}`,
                total: item.total,
                count: item.count
            })),
            expensesByCategory,
            topCategories
        });
    } catch (error) {
        console.error('Expense analytics error:', error);
        res.status(500).json({ error: 'Error fetching expense analytics' });
    }
};

// Get total expenses
exports.getTotalExpenses = async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        let query = {};

        if (startDate && endDate) {
            query.expense_date = {
                $gte: new Date(startDate),
                $lte: new Date(endDate)
            };
        }

        const total = await Expense.aggregate([
            { $match: query },
            { $group: { _id: null, total: { $sum: '$amount' } } }
        ]);

        res.json({ total: total[0]?.total || 0 });
    } catch (error) {
        res.status(500).json({ error: 'Error fetching total expenses' });
    }
};
