const Sale = require('../models/Sale');
const SaleItem = require('../models/SaleItem');
const Product = require('../models/Product');

// Create a new sale
exports.createSale = async (req, res) => {
    try {
        const { items, customer_name } = req.body;
        
        // Validate input
        if (!items || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ error: 'Items array is required and cannot be empty' });
        }

        // Calculate total amount and validate stock
        let total_amount = 0;
        for (const item of items) {
            if (!item.product_id || !item.quantity) {
                return res.status(400).json({ error: 'Each item must have product_id and quantity' });
            }
            
            const product = await Product.findById(item.product_id);
            if (!product) {
                return res.status(404).json({ error: `Product not found: ${item.product_id}` });
            }
            if (product.stock_quantity < item.quantity) {
                return res.status(400).json({ 
                    error: `Insufficient stock for product: ${product.name}`,
                    available: product.stock_quantity,
                    requested: item.quantity
                });
            }
            total_amount += product.price * item.quantity;
        }

        // Generate invoice number
        const lastSale = await Sale.findOne({}, {}, { sort: { 'invoice_number': -1 } });
        let nextNumber = 1;
        if (lastSale && lastSale.invoice_number) {
            const match = lastSale.invoice_number.match(/INV-(\d+)/);
            if (match) {
                nextNumber = parseInt(match[1]) + 1;
            }
        }
        const invoice_number = `INV-${String(nextNumber).padStart(6, '0')}`;

        // Create sale record
        const sale = new Sale({
            user_id: req.user._id,
            total_amount,
            customer_name: customer_name || 'Cash Customer',
            invoice_number
        });
        await sale.save();

        // Create sale items and update stock
        for (const item of items) {
            const product = await Product.findById(item.product_id);
            
            // Create sale item
            await SaleItem.create({
                sale_id: sale._id,
                product_id: item.product_id,
                quantity_sold: item.quantity,
                price_per_unit_at_sale: product.price
            });

            // Update stock
            product.stock_quantity -= item.quantity;
            await product.save();
        }

        const populatedSale = await Sale.findById(sale._id)
            .populate('user_id', 'username');

        res.status(201).json(populatedSale);
    } catch (error) {
        console.error('Sale creation error:', error);
        res.status(400).json({ error: 'Error creating sale: ' + error.message });
    }
};

// Get all sales
exports.getAllSales = async (req, res) => {
    try {
        const { startDate, endDate, limit } = req.query;
        let query = {};

        if (startDate && endDate) {
            query.sale_date = {
                $gte: new Date(startDate),
                $lte: new Date(endDate)
            };
        }

        let salesQuery = Sale.find(query)
            .populate('user_id', 'username')
            .sort({ sale_date: -1 });
        
        // Apply limit if provided
        if (limit && !isNaN(parseInt(limit))) {
            salesQuery = salesQuery.limit(parseInt(limit));
        }

        const sales = await salesQuery;
        res.json(sales);
    } catch (error) {
        console.error('Get all sales error:', error);
        res.status(500).json({ error: 'Error fetching sales' });
    }
};

// Get single sale with details
exports.getSale = async (req, res) => {
    try {
        const sale = await Sale.findById(req.params.id)
            .populate('user_id', 'username');
        
        if (!sale) {
            return res.status(404).json({ error: 'Sale not found' });
        }

        const saleItems = await SaleItem.find({ sale_id: sale._id })
            .populate('product_id', 'name price');

        res.json({
            ...sale.toObject(),
            items: saleItems
        });
    } catch (error) {
        res.status(500).json({ error: 'Error fetching sale' });
    }
};

// Get sales statistics
exports.getSalesStats = async (req, res) => {
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

        const [totalSales, totalAmount, salesCount] = await Promise.all([
            Sale.aggregate([
                { $match: { sale_date: dateFilter } },
                { $group: { _id: null, total: { $sum: '$total_amount' } } }
            ]),
            Sale.aggregate([
                { $match: { sale_date: dateFilter } },
                { $count: 'count' }
            ]),
            Sale.countDocuments({ sale_date: dateFilter })
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

        const [previousTotalSales] = await Promise.all([
            Sale.aggregate([
                { $match: { sale_date: previousDateFilter } },
                { $group: { _id: null, total: { $sum: '$total_amount' } } }
            ])
        ]);

        const currentTotal = totalSales[0]?.total || 0;
        const previousTotal = previousTotalSales[0]?.total || 0;
        const growthPercentage = previousTotal > 0 
            ? ((currentTotal - previousTotal) / previousTotal) * 100 
            : 0;

        res.json({
            total: currentTotal,
            count: salesCount,
            growth: Math.round(growthPercentage * 100) / 100,
            period
        });
    } catch (error) {
        console.error('Sales stats error:', error);
        res.status(500).json({ error: 'Error fetching sales statistics' });
    }
};

// Get sales analytics
exports.getSalesAnalytics = async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        let dateFilter = {};

        console.log('Sales analytics request with params:', { startDate, endDate });

        if (startDate && endDate) {
            dateFilter = {
                sale_date: {
                    $gte: new Date(startDate),
                    $lte: new Date(endDate)
                }
            };
        }

        console.log('Date filter:', dateFilter);

        // Get daily sales data
        const dailySales = await Sale.aggregate([
            { $match: dateFilter },
            {
                $group: {
                    _id: {
                        year: { $year: '$sale_date' },
                        month: { $month: '$sale_date' },
                        day: { $dayOfMonth: '$sale_date' }
                    },
                    total: { $sum: '$total_amount' },
                    count: { $sum: 1 }
                }
            },
            { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } }
        ]);

        console.log('Daily sales aggregation result:', dailySales);

        // Get top selling products
        const topProducts = await SaleItem.aggregate([
            {
                $lookup: {
                    from: 'sales',
                    localField: 'sale_id',
                    foreignField: '_id',
                    as: 'sale'
                }
            },
            { $unwind: '$sale' },
            { $match: dateFilter },
            {
                $lookup: {
                    from: 'products',
                    localField: 'product_id',
                    foreignField: '_id',
                    as: 'product'
                }
            },
            { $unwind: '$product' },
            {
                $group: {
                    _id: '$product_id',
                    name: { $first: '$product.name' },
                    totalQuantity: { $sum: '$quantity_sold' },
                    totalRevenue: { $sum: { $multiply: ['$quantity_sold', '$price_per_unit_at_sale'] } }
                }
            },
            { $sort: { totalRevenue: -1 } },
            { $limit: 10 }
        ]);

        console.log('Top products aggregation result:', topProducts);

        // Get sales by category (if products have categories)
        const salesByCategory = await SaleItem.aggregate([
            {
                $lookup: {
                    from: 'sales',
                    localField: 'sale_id',
                    foreignField: '_id',
                    as: 'sale'
                }
            },
            { $unwind: '$sale' },
            { $match: dateFilter },
            {
                $lookup: {
                    from: 'products',
                    localField: 'product_id',
                    foreignField: '_id',
                    as: 'product'
                }
            },
            { $unwind: '$product' },
            {
                $group: {
                    _id: { $ifNull: ['$product.category', 'Uncategorized'] },
                    totalRevenue: { $sum: { $multiply: ['$quantity_sold', '$price_per_unit_at_sale'] } },
                    totalQuantity: { $sum: '$quantity_sold' }
                }
            },
            { $sort: { totalRevenue: -1 } }
        ]);

        console.log('Sales by category aggregation result:', salesByCategory);

        const response = {
            dailySales: dailySales.map(item => ({
                date: `${item._id.year}-${String(item._id.month).padStart(2, '0')}-${String(item._id.day).padStart(2, '0')}`,
                total: item.total,
                count: item.count
            })),
            topProducts,
            salesByCategory
        };

        console.log('Sending analytics response:', response);
        res.json(response);
    } catch (error) {
        console.error('Sales analytics error:', error);
        res.status(500).json({ error: 'Error fetching sales analytics: ' + error.message });
    }
};

// Get product count
exports.getProductCount = async (req, res) => {
    try {
        const count = await Product.countDocuments();
        res.json({ count });
    } catch (error) {
        res.status(500).json({ error: 'Error fetching product count' });
    }
};

// Get product growth statistics
exports.getProductGrowth = async (req, res) => {
    try {
        const { period = 'month' } = req.query;
        
        let dateFilter = {};
        const now = new Date();
        
        switch (period) {
            case 'week':
                dateFilter = {
                    created_at: { $gte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) }
                };
                break;
            case 'month':
                dateFilter = {
                    created_at: { $gte: new Date(now.getFullYear(), now.getMonth(), 1) }
                };
                break;
            case 'quarter':
                const quarterStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
                dateFilter = { created_at: { $gte: quarterStart } };
                break;
            case 'year':
                dateFilter = {
                    created_at: { $gte: new Date(now.getFullYear(), 0, 1) }
                };
                break;
        }

        // Get current period product count
        const currentCount = await Product.countDocuments();

        // Get previous period for comparison
        let previousDateFilter = {};
        switch (period) {
            case 'week':
                previousDateFilter = {
                    created_at: {
                        $gte: new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000),
                        $lt: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
                    }
                };
                break;
            case 'month':
                previousDateFilter = {
                    created_at: {
                        $gte: new Date(now.getFullYear(), now.getMonth() - 1, 1),
                        $lt: new Date(now.getFullYear(), now.getMonth(), 1)
                    }
                };
                break;
            case 'quarter':
                const prevQuarterStart = new Date(now.getFullYear(), Math.floor((now.getMonth() - 3) / 3) * 3, 1);
                const currentQuarterStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
                previousDateFilter = {
                    created_at: {
                        $gte: prevQuarterStart,
                        $lt: currentQuarterStart
                    }
                };
                break;
            case 'year':
                previousDateFilter = {
                    created_at: {
                        $gte: new Date(now.getFullYear() - 1, 0, 1),
                        $lt: new Date(now.getFullYear(), 0, 1)
                    }
                };
                break;
        }

        // For product growth, we'll use a simple approach based on products created in the period
        // This assumes products have a createdAt field. If not, we'll use a default growth calculation
        const currentPeriodProducts = await Product.countDocuments(dateFilter);
        const previousPeriodProducts = await Product.countDocuments(previousDateFilter);

        const growthPercentage = previousPeriodProducts > 0 
            ? ((currentPeriodProducts - previousPeriodProducts) / previousPeriodProducts) * 100 
            : currentPeriodProducts > 0 ? 100 : 0;

        res.json({
            count: currentCount,
            growth: Math.round(growthPercentage * 100) / 100,
            period
        });
    } catch (error) {
        console.error('Product growth error:', error);
        res.status(500).json({ error: 'Error fetching product growth statistics' });
    }
};
