const express = require('express');
const router = express.Router();
const cartController = require('../controllers/CartController');
const { authMiddleware } = require('../middleware/auth');

router.get('/', authMiddleware, (req, res) => cartController.getCart(req, res));
router.put('/', authMiddleware, (req, res) => cartController.putCart(req, res));

module.exports = router;
