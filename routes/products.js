const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');
const auth = require('../middleware/auth');
const adminAuth = require('../middleware/adminAuth');

// Get all products (public)
router.get('/', productController.getAllProducts);

// Get single product (public)
router.get('/:id', productController.getProduct);

// Create product (admin only)
router.post('/', auth, adminAuth, productController.createProduct);

// Update product (admin only)
router.put('/:id', auth, adminAuth, productController.updateProduct);

// Delete product (admin only)
router.delete('/:id', auth, adminAuth, productController.deleteProduct);

module.exports = router;
