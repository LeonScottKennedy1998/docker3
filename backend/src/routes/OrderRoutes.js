const express = require('express');
const router = express.Router();
const orderController = require('../controllers/OrderController');
const { authMiddleware, roleMiddleware } = require('../middleware/auth');


router.post('/', 
    authMiddleware, 
    roleMiddleware('Клиент'), 
    orderController.createOrder.bind(orderController)
);

router.get('/my-orders', 
    authMiddleware, 
    roleMiddleware('Клиент'), 
    orderController.getUserOrders
);

router.get('/admin/all', 
    authMiddleware, 
    roleMiddleware('Товаровед'), 
    orderController.getAllOrders
);

router.patch('/admin/batch-status',
    authMiddleware,
    roleMiddleware('Товаровед'),
    orderController.batchUpdateOrderStatus
);

router.get('/admin/:id', 
    authMiddleware, 
    roleMiddleware('Товаровед'), 
    orderController.getOrderDetailsForMerchandiser
);

router.patch('/admin/:id/status', 
    authMiddleware, 
    roleMiddleware('Товаровед'), 
    orderController.updateOrderStatus
);

router.get('/statuses', 
    authMiddleware, 
    roleMiddleware('Товаровед', 'Администратор'), 
    orderController.getOrderStatuses
);

router.get('/:id', 
    authMiddleware, 
    roleMiddleware('Клиент'), 
    orderController.getOrderDetails
);


module.exports = router;