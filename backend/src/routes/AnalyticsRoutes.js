const express = require('express');
const router = express.Router();
const analyticsController = require('../controllers/AnalyticsController');
const { authMiddleware, roleMiddleware } = require('../middleware/auth');

router.get('/dashboard-stats', 
    authMiddleware, 
    roleMiddleware('Аналитик', 'Товаровед'), 
    analyticsController.getDashboardStats
);

router.get('/chart-data', 
    authMiddleware, 
    roleMiddleware('Аналитик', 'Товаровед'), 
    analyticsController.getChartData
);

router.post('/generate-report', 
    authMiddleware, 
    roleMiddleware('Аналитик', 'Товаровед'), 
    analyticsController.generateReport
);

module.exports = router;