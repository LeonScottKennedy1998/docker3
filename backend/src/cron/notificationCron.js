const cron = require('node-cron');
const pool = require('../config/database');
const WishlistNotificationService = require('../services/wishlistNotificationService');

async function checkStockNotifications() {
    console.log('⏰ [CRON] Запуск проверки товаров, которые появились в наличии...');
    const client = await pool.connect(); 
    try {
        await client.query('BEGIN'); 
        
        const result = await client.query(`
            SELECT 
                w.user_id,
                u.email,
                u.first_name,
                u.last_name,
                w.product_id,
                p.product_name,
                p.price,
                p.stock,
                c.category_name,
                COALESCE(
                    (SELECT discount_percent 
                     FROM discounts d 
                     WHERE d.product_id = p.product_id 
                     AND (d.end_date IS NULL OR d.end_date > NOW())
                     LIMIT 1), 0
                ) as discount_percent
            FROM wishlist w
            JOIN users u ON w.user_id = u.user_id
            JOIN products p ON w.product_id = p.product_id
            JOIN categories c ON p.category_id = c.category_id
            WHERE p.stock > 0 
            AND p.is_active = true
            AND p.updated_at > NOW() - INTERVAL '1 hour'
            AND p.updated_at != p.created_at
            AND NOT EXISTS (
                SELECT 1 FROM wishlist_notifications n
                WHERE n.user_id = w.user_id 
                AND n.product_id = w.product_id
                AND n.notification_type = 'stock_available'
                AND n.sent_at >= CURRENT_DATE 
                AND n.sent_at < CURRENT_DATE + INTERVAL '1 day'
            )
            ORDER BY w.user_id, w.product_id
        `);

        console.log(`📨 [CRON] Найдено ${result.rows.length} товаров для уведомления о наличии`);

        let sentCount = 0;
        for (const item of result.rows) {
            try {
                let userName = `${item.first_name} ${item.last_name}`;
                if (item.first_name && item.first_name.includes('{"iv":')) {
                    const encryption = require('../utils/encryption');
                    try {
                        const decryptedFirstName = encryption.decryptFromDB(item.first_name);
                        const decryptedLastName = encryption.decryptFromDB(item.last_name);
                        userName = `${decryptedFirstName} ${decryptedLastName}`;
                    } catch (e) {
                        console.error('Ошибка дешифрования:', e);
                        userName = item.email.split('@')[0];
                    }
                }

                const productData = {
                    product_name: item.product_name,
                    category_name: item.category_name,
                    price: parseFloat(item.price),
                    stock: item.stock,
                    has_discount: item.discount_percent > 0,
                    discount_percent: parseFloat(item.discount_percent),
                    final_price: item.discount_percent > 0 
                        ? item.price * (1 - item.discount_percent / 100)
                        : item.price
                };

                const sent = await WishlistNotificationService.sendStockAvailableNotification(
                    item.email,
                    productData,
                    userName
                );

                 if (sent) {
                    await client.query(
                        `INSERT INTO wishlist_notifications 
                         (user_id, product_id, notification_type, old_value, new_value, sent_at, sent_date)
                         VALUES ($1, $2, 'stock_available', '0', $3, NOW(), CURRENT_DATE)
                         ON CONFLICT (user_id, product_id, notification_type, sent_date)
                         DO UPDATE SET
                           sent_at = EXCLUDED.sent_at,
                           new_value = EXCLUDED.new_value,
                           old_value = EXCLUDED.old_value`,
                        [item.user_id, item.product_id, item.stock.toString()]
                    );
                    sentCount++;
                }
            } catch (error) {
                console.error(`❌ [CRON] Ошибка для пользователя ${item.user_id}:`, error.message);
            }
        }

        await client.query('COMMIT');
        console.log(`✅ [CRON] Отправлено ${sentCount} уведомлений о наличии товаров`);
        return sentCount;

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ [CRON] Ошибка проверки уведомлений о наличии:', error);
        console.error('❌ Детали ошибки:', error.message);
        return 0;
    } finally {
        client.release();
    }
}

async function checkDiscountNotifications() {
    console.log('⏰ [CRON] Запуск проверки новых скидок...');

    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        const result = await client.query(`
            SELECT DISTINCT ON (w.user_id, w.product_id)
                w.user_id,
                u.email,
                u.first_name,
                u.last_name,
                w.product_id,
                p.product_name,
                p.price as old_price,
                c.category_name,
                d.discount_percent,
                p.stock
            FROM wishlist w
            JOIN users u ON w.user_id = u.user_id
            JOIN products p ON w.product_id = p.product_id
            JOIN categories c ON p.category_id = c.category_id
            JOIN discounts d ON p.product_id = d.product_id
            WHERE p.is_active = true
            AND d.created_at > NOW() - INTERVAL '1 hour'
            AND (d.end_date IS NULL OR d.end_date > NOW())
            AND NOT EXISTS (
                SELECT 1 FROM wishlist_notifications n
                WHERE n.user_id = w.user_id 
                AND n.product_id = w.product_id
                AND n.notification_type = 'discount'
                AND n.sent_at >= CURRENT_DATE 
                AND n.sent_at < CURRENT_DATE + INTERVAL '1 day'
            )
            ORDER BY w.user_id, w.product_id, d.created_at DESC
        `);

        console.log(`📨 [CRON] Найдено ${result.rows.length} товаров со скидками для уведомления`);

        let sentCount = 0;
        for (const item of result.rows) {
            try {
                let userName = `${item.first_name} ${item.last_name}`;
                if (item.first_name && item.first_name.includes('{"iv":')) {
                    const encryption = require('../utils/encryption');
                    try {
                        const decryptedFirstName = encryption.decryptFromDB(item.first_name);
                        const decryptedLastName = encryption.decryptFromDB(item.last_name);
                        userName = `${decryptedFirstName} ${decryptedLastName}`;
                    } catch (e) {
                        console.error('Ошибка дешифрования:', e);
                        userName = item.email.split('@')[0];
                    }
                }

                const newPrice = item.old_price * (1 - item.discount_percent / 100);
                
                const productData = {
                    product_name: item.product_name,
                    category_name: item.category_name,
                    stock: item.stock
                };

                const sent = await WishlistNotificationService.sendDiscountNotification(
                    item.email,
                    productData,
                    userName,
                    parseFloat(item.old_price),
                    newPrice,
                    item.discount_percent
                );

                if (sent) {
                    const checkToday = await client.query(
                        `SELECT 1 FROM wishlist_notifications 
                         WHERE user_id = $1 
                         AND product_id = $2 
                         AND notification_type = 'discount'
                         AND sent_at >= CURRENT_DATE 
                         AND sent_at < CURRENT_DATE + INTERVAL '1 day'
                         LIMIT 1`,
                        [item.user_id, item.product_id]
                    );

                    if (checkToday.rows.length === 0) {
                        await client.query(
                            `INSERT INTO wishlist_notifications 
                             (user_id, product_id, notification_type, old_value, new_value, sent_at)
                             VALUES ($1, $2, 'discount', $3, $4, NOW())`,
                            [item.user_id, item.product_id, item.old_price.toString(), newPrice.toString()]
                        );
                        sentCount++;
                    } else {
                        console.log(`⚠️ Уже отправлено сегодня для user ${item.user_id}, product ${item.product_id}`);
                    }
                }
            } catch (error) {
                console.error(`❌ [CRON] Ошибка для пользователя ${item.user_id}:`, error.message);
            }
        }

        await client.query('COMMIT');
        console.log(`✅ [CRON] Отправлено ${sentCount} уведомлений о скидках`);
        return sentCount;

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ [CRON] Ошибка проверки уведомлений о скидках:', error);
        console.error('❌ Детали ошибки:', error.message);
        return 0;
    } finally {
        client.release();
    }
}

async function runAllNotifications() {
    console.log('🚀 [CRON] Запуск всех проверок уведомлений...');
    const startTime = Date.now();
    
    try {
        console.log('\n📦 Проверка уведомлений о наличии...');
        const stockCount = await checkStockNotifications();
        
        console.log('\n🏷️ Проверка уведомлений о скидках...');
        const discountCount = await checkDiscountNotifications();
        
        const elapsedTime = Date.now() - startTime;
        console.log(`\n✅ [CRON] Все проверки завершены за ${elapsedTime}ms`);
        console.log(`📊 [CRON] Итого отправлено: ${stockCount + discountCount} уведомлений`);
        console.log(`   - О наличии товаров: ${stockCount}`);
        console.log(`   - О скидках: ${discountCount}`);
        
        return {
            stock_notifications: stockCount,
            discount_notifications: discountCount,
            total: stockCount + discountCount,
            elapsed_time: elapsedTime
        };
    } catch (error) {
        console.error('❌ [CRON] Ошибка выполнения проверок:', error);
        throw error;
    }
}

function setupCronJobs() {
    console.log('⏰ Настройка крон-задач...');
    
    cron.schedule('*/30 * * * *', async () => {
        console.log('\n📅 ====== Запуск плановой проверки (каждые 30 мин) ======');
        await runAllNotifications();
    });
    
    cron.schedule('0 9 * * *', async () => {
        console.log('\n🌅 ====== Утренняя проверка (9:00) ======');
        await runAllNotifications();
    });
    
    cron.schedule('0 18 * * *', async () => {
        console.log('\n🌇 ====== Вечерняя проверка (18:00) ======');
        await runAllNotifications();
    });
    
    console.log('✅ Крон-задачи настроены:');
    console.log('   - Каждые 30 минут');
    console.log('   - Ежедневно в 9:00');
    console.log('   - Ежедневно в 18:00');
}

module.exports = {
    setupCronJobs,
    runAllNotifications,
    checkStockNotifications,
    checkDiscountNotifications
};