const express = require('express');
const router = express.Router();
const categoryController = require('../controllers/CategoryController');
const { authMiddleware, roleMiddleware } = require('../middleware/auth');

router.use(authMiddleware);

router.get('/', categoryController.getCategories);

router.post('/', 
    roleMiddleware('Товаровед'), 
    categoryController.createCategory
);

router.put('/:id', 
    roleMiddleware('Товаровед'), 
    categoryController.updateCategory
);

router.delete('/:id', 
    roleMiddleware('Товаровед'), 
    categoryController.deleteCategory
);

module.exports = router;