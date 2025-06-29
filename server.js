require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/database');

// Import routes
const authRoutes = require('./routes/auth');
const productRoutes = require('./routes/products');
const saleRoutes = require('./routes/sales');
const expenseRoutes = require('./routes/expenses');

const app = express();

// Set default environment variables if not provided
process.env.NODE_ENV = process.env.NODE_ENV || 'development';
process.env.MONGODB_URI_DEV = process.env.MONGODB_URI_DEV || 'mongodb://localhost:27017/sales_management';
process.env.MONGODB_URI_PROD = process.env.MONGODB_URI_PROD || 'mongodb://localhost:27017/sales_management';

// Connect to MongoDB
connectDB();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Route Handlers
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/sales', saleRoutes);
app.use('/api/expenses', expenseRoutes);

// Test endpoint to verify server is working
app.get('/api/test', (req, res) => {
    res.json({ message: 'Server is running!', timestamp: new Date().toISOString() });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Server Error:', err);
    const statusCode = err.statusCode || 500;
    res.status(statusCode).json({
        error: err.message || 'Something went wrong!',
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Route not found' });
});

const port = process.env.PORT || 3001;
app.listen(port, () => console.log(`Server running on port ${port}`));