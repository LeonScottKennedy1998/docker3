const pool = require('../config/database');
const encryption = require('../utils/encryption');


function safeDecryptName(value, fallback = '') {
    if (!value || typeof value !== 'string') return fallback;
    if (!value.includes('{"iv":')) return value;
    try {
        return encryption.decryptFromDB(value);
    } catch (err) {
        console.error('Не удалось расшифровать имя пользователя:', err.message);
        return fallback;
    }
}

class ReviewController {
    async getProductReviews(req, res) {
        try {
            const { productId } = req.params;
            
            const reviews = await pool.query(`
                SELECT 
                    r.review_id,
                    r.rating,
                    r.comment,
                    r.created_at,
                    r.updated_at,
                    u.user_id,
                    u.first_name,
                    u.last_name
                FROM reviews r
                JOIN users u ON r.user_id = u.user_id
                WHERE r.product_id = $1
                ORDER BY r.created_at DESC
            `, [productId]);
            
            const avgRating = await pool.query(`
                SELECT 
                    COALESCE(AVG(rating), 0) as avg_rating,
                    COUNT(*) as total_reviews
                FROM reviews
                WHERE product_id = $1
            `, [productId]);

            const decryptedReviews = reviews.rows.map(row => ({
                ...row,
                first_name: safeDecryptName(row.first_name, 'Покупатель'),
                last_name: safeDecryptName(row.last_name, '')
            }));

            res.json({
                reviews: decryptedReviews,
                avg_rating: parseFloat(avgRating.rows[0].avg_rating),
                total_reviews: parseInt(avgRating.rows[0].total_reviews)
            });
        } catch (error) {
            console.error('Ошибка получения отзывов:', error);
            res.status(500).json({ error: 'Ошибка получения отзывов' });
        }
    }
    
    async createReview(req, res) {
        try {
            const userId = req.user.userId;
            const { productId } = req.params;
            const { rating, comment, preorder_id: preorderId } = req.body;

            if (!preorderId) {
                return res.status(400).json({
                    error: 'Не указан заказ (preorder_id), к которому относится отзыв'
                });
            }

            if (!rating || rating < 1 || rating > 5) {
                return res.status(400).json({
                    error: 'Оценка должна быть от 1 до 5'
                });
            }

            const checkOrder = await pool.query(`
                SELECT EXISTS (
                    SELECT 1 FROM preorders pr
                    JOIN preorder_items pi ON pr.pr_id = pi.preorder_id
                    WHERE pr.pr_id = $1
                      AND pr.user_id = $2
                      AND pi.product_id = $3
                      AND pr.status_id = 4
                ) as is_valid
            `, [preorderId, userId, productId]);

            if (!checkOrder.rows[0].is_valid) {
                return res.status(403).json({
                    error: 'Отзыв можно оставить только на товар из вашего выданного заказа'
                });
            }

            const existingReview = await pool.query(`
                SELECT review_id FROM reviews 
                WHERE product_id = $1 AND user_id = $2 AND preorder_id = $3
            `, [productId, userId, preorderId]);

            if (existingReview.rows.length > 0) {
                return res.status(400).json({
                    error: 'Вы уже оставили отзыв на этот товар в этом заказе'
                });
            }

            const result = await pool.query(`
                INSERT INTO reviews (product_id, user_id, preorder_id, rating, comment)
                VALUES ($1, $2, $3, $4, $5)
                RETURNING review_id, rating, comment, preorder_id, created_at
            `, [productId, userId, preorderId, rating, comment]);

            await pool.query(`
                INSERT INTO audit_log (user_id, audit_action, audit_table, table_id, new_data)
                VALUES ($1, 'CREATE_REVIEW', 'reviews', $2, $3)
            `, [
                userId,
                result.rows[0].review_id,
                JSON.stringify({ product_id: productId, preorder_id: preorderId, rating })
            ]);

            res.status(201).json({
                message: 'Отзыв успешно добавлен',
                review: result.rows[0]
            });

        } catch (error) {
            console.error('Ошибка создания отзыва:', error);
            res.status(500).json({ error: 'Ошибка создания отзыва' });
        }
    }
    
async getReviewableProducts(req, res) {
    try {
        const userId = req.user.userId;
        
        console.log('========================================');
        console.log('🔍 НАЧАЛО: getReviewableProducts для пользователя:', userId);
        console.log('========================================');
        
        const checkOrders = await pool.query(`
            SELECT pr_id, status_id, created_at 
            FROM preorders 
            WHERE user_id = $1 AND status_id = 4
        `, [userId]);
        
        console.log(`📦 Количество выданных заказов: ${checkOrders.rows.length}`);
        if (checkOrders.rows.length > 0) {
            console.log('📋 Выданные заказы:', checkOrders.rows);
        } else {
            console.log('❌ Нет выданных заказов!');
        }
        
        const allOrders = await pool.query(`
            SELECT pr_id, status_id, created_at 
            FROM preorders 
            WHERE user_id = $1
        `, [userId]);
        console.log(`📋 Всего заказов у пользователя: ${allOrders.rows.length}`);
        
        const result = await pool.query(`
            SELECT DISTINCT 
                p.product_id as id,
                p.product_name as name,
                p.description,
                p.price,
                p.image_url,
                p.category_id,
                c.category_name as category,
                pr.updated_at as order_date,
                pr.pr_id as order_id,
                CASE WHEN r.review_id IS NOT NULL THEN true ELSE false END as has_reviewed,
                r.rating as rating,
                r.comment as comment,
                r.review_id as review_id,
                r.created_at as review_created_at,
                r.updated_at as review_updated_at
            FROM preorders pr
            JOIN preorder_items pi ON pr.pr_id = pi.preorder_id
            JOIN products p ON pi.product_id = p.product_id
            LEFT JOIN categories c ON p.category_id = c.category_id
            LEFT JOIN reviews r 
                ON r.product_id = p.product_id 
               AND r.user_id = $1
               AND r.preorder_id = pr.pr_id
            WHERE pr.user_id = $1 
            AND pr.status_id = 4
            ORDER BY pr.updated_at DESC
        `, [userId]);
        
        console.log(`✅ SQL запрос вернул ${result.rows.length} записей`);
        
        if (result.rows.length > 0) {
            console.log('📋 Результат запроса:');
            result.rows.forEach((row, idx) => {
                console.log(`  ${idx + 1}. ID:${row.id} | ${row.name} | order_id:${row.order_id} | has_reviewed:${row.has_reviewed}`);
            });
        } else {
            console.log('❌ SQL запрос вернул пустой результат!');
            
            const itemsCheck = await pool.query(`
                SELECT COUNT(*) as count
                FROM preorders pr
                JOIN preorder_items pi ON pr.pr_id = pi.preorder_id
                WHERE pr.user_id = $1 AND pr.status_id = 4
            `, [userId]);
            
            console.log(`📦 Количество позиций в выданных заказах: ${itemsCheck.rows[0].count}`);
            
            if (itemsCheck.rows[0].count === 0) {
                console.log('❌ В выданных заказах нет товаров в preorder_items!');
                
                const ordersWithItems = await pool.query(`
                    SELECT pr.pr_id, COUNT(pi.product_id) as items_count
                    FROM preorders pr
                    LEFT JOIN preorder_items pi ON pr.pr_id = pi.preorder_id
                    WHERE pr.user_id = $1 AND pr.status_id = 4
                    GROUP BY pr.pr_id
                `, [userId]);
                
                console.log('📋 Заказы и количество товаров в них:');
                ordersWithItems.rows.forEach(row => {
                    console.log(`  Заказ ${row.pr_id}: ${row.items_count} товаров`);
                });
            }
        }
        
        console.log('========================================');
        console.log(`📤 ОТВЕТ: возвращаем ${result.rows.length} товаров`);
        console.log('========================================');
        
        res.json(result.rows);
        
    } catch (error) {
        console.error('❌ ОШИБКА в getReviewableProducts:', error);
        res.status(500).json({ error: 'Ошибка получения данных' });
    }
}
    
    async getMyReviews(req, res) {
        try {
            const userId = req.user.userId;
            
            const reviews = await pool.query(`
                SELECT 
                    r.review_id,
                    r.rating,
                    r.comment,
                    r.created_at,
                    r.updated_at,
                    r.preorder_id,
                    pr.updated_at as order_date,
                    p.product_id,
                    p.product_name,
                    p.price,
                    p.image_url
                FROM reviews r
                JOIN products p ON r.product_id = p.product_id
                LEFT JOIN preorders pr ON pr.pr_id = r.preorder_id
                WHERE r.user_id = $1
                ORDER BY r.created_at DESC
            `, [userId]);
            
            res.json(reviews.rows);
        } catch (error) {
            console.error('Ошибка получения отзывов пользователя:', error);
            res.status(500).json({ error: 'Ошибка получения отзывов' });
        }
    }
    
    async deleteReview(req, res) {
        try {
            const userId = req.user.userId;
            const { reviewId } = req.params;

            const ownership = await pool.query(`
                SELECT r.review_id, pr.status_id
                FROM reviews r
                LEFT JOIN preorders pr ON pr.pr_id = r.preorder_id
                WHERE r.review_id = $1 AND r.user_id = $2
            `, [reviewId, userId]);

            if (ownership.rows.length === 0) {
                return res.status(404).json({ error: 'Отзыв не найден' });
            }

            if (ownership.rows[0].status_id !== 4) {
                return res.status(403).json({
                    error: 'Удалить отзыв можно только пока заказ имеет статус «Выдан»'
                });
            }

            const result = await pool.query(`
                DELETE FROM reviews 
                WHERE review_id = $1 AND user_id = $2
                RETURNING review_id
            `, [reviewId, userId]);

            if (result.rows.length === 0) {
                return res.status(404).json({ error: 'Отзыв не найден' });
            }

            res.json({ message: 'Отзыв удален' });
        } catch (error) {
            console.error('Ошибка удаления отзыва:', error);
            res.status(500).json({ error: 'Ошибка удаления отзыва' });
        }
    }

    async updateReview(req, res) {
        try {
            const userId = req.user.userId;
            const { reviewId } = req.params;
            const { rating, comment } = req.body;

            if (!rating || rating < 1 || rating > 5) {
                return res.status(400).json({
                    error: 'Оценка должна быть от 1 до 5'
                });
            }

            const ownership = await pool.query(
                `SELECT review_id FROM reviews WHERE review_id = $1 AND user_id = $2`,
                [reviewId, userId]
            );

            if (ownership.rows.length === 0) {
                return res.status(404).json({ error: 'Отзыв не найден' });
            }

            const result = await pool.query(`
                UPDATE reviews 
                SET rating = $1, comment = $2, updated_at = NOW()
                WHERE review_id = $3 AND user_id = $4
                RETURNING review_id, rating, comment, updated_at
            `, [rating, comment, reviewId, userId]);

            if (result.rows.length === 0) {
                return res.status(404).json({ error: 'Отзыв не найден' });
            }

            res.json({
                message: 'Отзыв обновлен',
                review: result.rows[0]
            });
        } catch (error) {
            console.error('Ошибка обновления отзыва:', error);
            res.status(500).json({ error: 'Ошибка обновления отзыва' });
        }
    }
}

module.exports = new ReviewController();