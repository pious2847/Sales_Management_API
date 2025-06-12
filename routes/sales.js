const express = require('express');
const router = express.Router();
const saleController = require('../controllers/saleController');
const auth = require('../middleware/auth');

// Create a new sale (authenticated users)
router.post('/', auth, saleController.createSale);

// Get all sales (authenticated users)
router.get('/', auth, saleController.getAllSales);

// Get single sale with details (authenticated users)
router.get('/:id', auth, saleController.getSale);

module.exports = router;
