const mongoose = require('mongoose');

const saleItemSchema = new mongoose.Schema({
    sale_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Sale',
        required: true
    },
    product_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
        required: true
    },
    quantity_sold: {
        type: Number,
        required: true,
        min: 1
    },
    price_per_unit_at_sale: {
        type: Number,
        required: true,
        min: 0
    }
}, {
    timestamps: { 
        createdAt: 'created_at',
        updatedAt: 'updated_at'
    }
});

module.exports = mongoose.model('SaleItem', saleItemSchema);
