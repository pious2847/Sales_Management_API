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
        unique: true,
        sparse: true // Allow multiple null values
    }
}, {
    timestamps: { 
        createdAt: 'created_at',
        updatedAt: 'updated_at'
    }
});

// Auto-generate invoice number before saving
saleSchema.pre('save', async function(next) {
    try {
        if (!this.invoice_number) {
            // Find the last sale by invoice number to get the highest number
            const lastSale = await this.constructor.findOne({}, {}, { 
                sort: { 'invoice_number': -1 } 
            });
            
            let nextNumber = 1;
            if (lastSale && lastSale.invoice_number) {
                // Extract number from invoice_number format "INV-000001"
                const match = lastSale.invoice_number.match(/INV-(\d+)/);
                if (match) {
                    nextNumber = parseInt(match[1]) + 1;
                }
            }
            
            this.invoice_number = `INV-${String(nextNumber).padStart(6, '0')}`;
        }
        next();
    } catch (error) {
        next(error);
    }
});

module.exports = mongoose.model('Sale', saleSchema);
