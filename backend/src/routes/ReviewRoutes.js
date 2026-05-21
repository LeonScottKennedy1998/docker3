const express = require('express');
const router = express.Router();
const reviewController = require('../controllers/ReviewController');
const { authMiddleware, roleMiddleware } = require('../middleware/auth');

router.get('/product/:productId', reviewController.getProductReviews);

router.post('/product/:productId', 
    authMiddleware, 
    roleMiddleware('Клиент'), 
    reviewController.createReview
);

router.get('/my-reviews', 
    authMiddleware, 
    roleMiddleware('Клиент'), 
    reviewController.getMyReviews
);

router.delete('/:reviewId', 
    authMiddleware, 
    roleMiddleware('Клиент'), 
    reviewController.deleteReview
);

router.get('/available', 
    authMiddleware, 
    roleMiddleware('Клиент'), 
    reviewController.getReviewableProducts
);

router.put('/:reviewId', 
    authMiddleware, 
    roleMiddleware('Клиент'), 
    reviewController.updateReview
);

module.exports = router;