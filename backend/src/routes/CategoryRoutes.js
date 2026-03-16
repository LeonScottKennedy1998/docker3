const express = require('express');
const router = express.Router();
const categoryController = require('../controllers/CategoryController');
const { authMiddleware, roleMiddleware } = require('../middleware/auth');

// Все маршруты категорий доступны только авторизованным пользователям
router.use(authMiddleware);

// Получение всех категорий (доступно всем авторизованным)
router.get('/', categoryController.getCategories);

// Создание категории (только для товароведов и админов)
router.post('/', 
    roleMiddleware('Товаровед'), 
    categoryController.createCategory
);

// Обновление категории
router.put('/:id', 
    roleMiddleware('Товаровед'), 
    categoryController.updateCategory
);

// Удаление категории
router.delete('/:id', 
    roleMiddleware('Товаровед'), 
    categoryController.deleteCategory
);

module.exports = router;