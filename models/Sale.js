const mongoose = require('mongoose');

const saleSchema = new mongoose.Schema({
    user_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    total_amount: {
        type: Number,
        required: true,
        min: 0
    },
    sale_date: {
        type: Date,
        default: Date.now
    },
    customer_name: {
        type: String,
        default: 'Cash Customer'
    },
    invoice_number: {
        type: String,
        required: true,
        unique: true
    }
}, {
    timestamps: { 
        createdAt: 'created_at',
        updatedAt: 'updated_at'
    }
});

// Auto-generate invoice number before saving
saleSchema.pre('save', async function(next) {
    if (!this.invoice_number) {
        const lastSale = await this.constructor.findOne({}, {}, { sort: { 'created_at': -1 } });
        const lastNumber = lastSale ? parseInt(lastSale.invoice_number.split('-')[1]) : 0;
        this.invoice_number = `INV-${String(lastNumber + 1).padStart(6, '0')}`;
    }
    next();
});

module.exports = mongoose.model('Sale', saleSchema);
