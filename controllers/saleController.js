const Sale = require('../models/Sale');
const SaleItem = require('../models/SaleItem');
const Product = require('../models/Product');

// Create a new sale
exports.createSale = async (req, res) => {
    try {
        const { items, customer_name } = req.body;
        
        // Calculate total amount and validate stock
        let total_amount = 0;
        for (const item of items) {
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

        // Create sale record
        const sale = new Sale({
            user_id: req.user._id,
            total_amount,
            customer_name: customer_name || 'Cash Customer'
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
        res.status(400).json({ error: 'Error creating sale' });
    }
};

// Get all sales
exports.getAllSales = async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        let query = {};

        if (startDate && endDate) {
            query.sale_date = {
                $gte: new Date(startDate),
                $lte: new Date(endDate)
            };
        }

        const sales = await Sale.find(query)
            .populate('user_id', 'username')
            .sort({ sale_date: -1 });
        
        res.json(sales);
    } catch (error) {
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
