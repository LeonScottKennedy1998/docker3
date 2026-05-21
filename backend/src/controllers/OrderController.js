const pool = require('../config/database');
const nodemailer = require('nodemailer');

const MERCHANDISER_ARCHIVE_DAYS = 30;


const ORDER_STATUS_TRANSITIONS = {
    'В обработке': ['Подтвержден', 'Отменен'],
    'Подтвержден': ['Выдан'],
    'Отменен': [],
    'Выдан': []
};

function isOrderTransitionAllowed(fromStatusName, toStatusName) {
    if (!fromStatusName || !toStatusName) return false;
    if (fromStatusName === toStatusName) return true;
    const allowed = ORDER_STATUS_TRANSITIONS[fromStatusName];
    return Array.isArray(allowed) && allowed.includes(toStatusName);
}

/**
 * @param {import('pg').Pool|import('pg').PoolClient} db
 */
async function executeOrderStatusUpdate(db, orderId, newStatusName, adminUserId) {
    const statusResult = await db.query(
        'SELECT ps_id, ps_name FROM preorder_status WHERE ps_name = $1',
        [newStatusName]
    );

    if (statusResult.rows.length === 0) {
        throw new Error('Неверный статус');
    }

    const statusId = statusResult.rows[0].ps_id;
    const resolvedNewName = statusResult.rows[0].ps_name;

    const currentOrder = await db.query(
        'SELECT status_id FROM preorders WHERE pr_id = $1 FOR UPDATE',
        [orderId]
    );

    if (currentOrder.rows.length === 0) {
        throw new Error('Заказ не найден');
    }

    const oldStatusId = currentOrder.rows[0].status_id;

    if (oldStatusId === statusId) {
        const ns = await db.query('SELECT ps_name FROM preorder_status WHERE ps_id = $1', [statusId]);
        return {
            unchanged: true,
            newStatusName: ns.rows[0]?.ps_name || newStatusName
        };
    }

    const oldStatusResult = await db.query(
        'SELECT ps_name FROM preorder_status WHERE ps_id = $1',
        [oldStatusId]
    );
    const oldStatusName = oldStatusResult.rows[0]?.ps_name || 'Неизвестно';

    if (!isOrderTransitionAllowed(oldStatusName, newStatusName)) {
        throw new Error(`Переход «${oldStatusName}» → «${newStatusName}» невозможен`);
    }

    const result = await db.query(
        `UPDATE preorders 
         SET status_id = $1, updated_at = NOW()
         WHERE pr_id = $2
         RETURNING pr_id as id, total, updated_at`,
        [statusId, orderId]
    );

    if (resolvedNewName === 'Отменен') {
        const items = await db.query(
            `SELECT pi.product_id, pi.quantity
             FROM preorder_items pi
             WHERE pi.preorder_id = $1`,
            [orderId]
        );

        for (const item of items.rows) {
            await db.query(
                `UPDATE products 
                 SET stock = stock + $1
                 WHERE product_id = $2`,
                [item.quantity, item.product_id]
            );
        }
    }

    await db.query(
        `INSERT INTO audit_log 
         (user_id, audit_action, audit_table, table_id, old_data, new_data)
         VALUES ($1, 'UPDATE_ORDER_STATUS', 'preorders', $2, $3, $4)`,
        [
            adminUserId,
            orderId,
            JSON.stringify({ status: oldStatusName }),
            JSON.stringify({ status: resolvedNewName })
        ]
    );

    return {
        unchanged: false,
        order: result.rows[0],
        newStatusName: resolvedNewName
    };
}

class OrderController {
    async createOrder(req, res) {
        const userId = req.user.userId;
        const { items, phone } = req.body;

        if (!items || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ error: 'Корзина пуста' });
        }

        const client = await pool.connect();

        try {
            await client.query('BEGIN');

            let total = 0;
            const orderItems = [];

            for (const item of items) {
                const productResult = await client.query(
                    `SELECT product_id, price, stock, product_name
                     FROM products
                     WHERE product_id = $1 AND is_active = true
                     FOR UPDATE`,
                    [item.productId]
                );

                if (productResult.rows.length === 0) {
                    await client.query('ROLLBACK');
                    return res.status(400).json({
                        error: `Товар с ID ${item.productId} не найден`
                    });
                }

                const product = productResult.rows[0];

                if (product.stock < item.quantity) {
                    await client.query('ROLLBACK');
                    return res.status(400).json({
                        error: `Недостаточно товара "${product.product_name}" на складе. Доступно: ${product.stock} шт.`
                    });
                }

                let itemPrice = product.price;

                const discountResult = await client.query(`
                    SELECT discount_percent
                    FROM discounts
                    WHERE product_id = $1
                    AND (end_date IS NULL OR end_date > NOW())
                    ORDER BY created_at DESC
                    LIMIT 1
                `, [item.productId]);

                if (discountResult.rows.length > 0) {
                    const discountPercent = discountResult.rows[0].discount_percent;
                    if (discountPercent > 0 && discountPercent <= 100) {
                        itemPrice = product.price * (1 - discountPercent / 100);
                        itemPrice = Math.round(itemPrice * 100) / 100;
                    }
                }

                const itemTotal = itemPrice * item.quantity;
                total += itemTotal;

                orderItems.push({
                    product_id: product.product_id,
                    product_name: product.product_name,
                    quantity: item.quantity,
                    price: itemPrice,
                    itemTotal: itemTotal
                });
            }

            const userResult = await client.query(
                'SELECT email, first_name, last_name FROM users WHERE user_id = $1',
                [userId]
            );

            if (userResult.rows.length === 0) {
                await client.query('ROLLBACK');
                return res.status(404).json({ error: 'Пользователь не найден' });
            }

            const user = userResult.rows[0];

            const orderResult = await client.query(
                `INSERT INTO preorders
                 (user_id, status_id, total, phone, created_at, updated_at)
                 VALUES ($1, 1, $2, $3, NOW(), NOW())
                 RETURNING pr_id as id, total, created_at`,
                [userId, total, phone || req.user.phone]
            );

            const orderId = orderResult.rows[0].id;

            for (const item of orderItems) {
                await client.query(
                    `INSERT INTO preorder_items
                     (preorder_id, product_id, quantity, price)
                     VALUES ($1, $2, $3, $4)`,
                    [orderId, item.product_id, item.quantity, item.price]
                );

                const stockUpdate = await client.query(
                    `UPDATE products
                     SET stock = stock - $1
                     WHERE product_id = $2 AND stock >= $1
                     RETURNING product_id`,
                    [item.quantity, item.product_id]
                );

                if (stockUpdate.rows.length === 0) {
                    throw new Error(`Недостаточно товара "${item.product_name}" на складе`);
                }
            }

            await client.query(
                `INSERT INTO audit_log
                 (user_id, audit_action, audit_table, table_id, new_data)
                 VALUES ($1, 'CREATE_ORDER', 'preorders', $2, $3)`,
                [userId, orderId, JSON.stringify({ total, items_count: items.length, stock_reserved: true })]
            );

            await client.query('DELETE FROM user_cart_items WHERE user_id = $1', [userId]).catch(() => {});
            await client.query('COMMIT');

            this.sendOrderEmail(user.email, orderId, total, orderItems, user)
                .catch(emailError => {
                    console.error('Ошибка отправки email:', emailError);
                });

            return res.status(201).json({
                message: 'Заказ успешно оформлен! Чек отправлен на вашу почту.',
                order: {
                    id: orderId,
                    total: orderResult.rows[0].total,
                    created_at: orderResult.rows[0].created_at,
                    items_count: items.length,
                    email_sent: true
                }
            });

        } catch (error) {
            await client.query('ROLLBACK').catch(() => {});
            console.error('Ошибка создания заказа:', error);
            const msg = error && error.message ? error.message : '';
            if (msg.includes('Недостаточно')) {
                return res.status(400).json({ error: msg });
            }
            return res.status(500).json({ error: 'Ошибка создания заказа' });
        } finally {
            client.release();
        }
    }

    async sendOrderEmail(email, orderId, total, items, user) {
    const SMTP_USER = process.env.EMAIL_USER || process.env.SMTP_USER;
    const SMTP_PASS = process.env.EMAIL_PASSWORD || process.env.SMTP_PASS;
    const SMTP_HOST = process.env.EMAIL_HOST || process.env.SMTP_HOST || 'smtp.gmail.com';
    const SMTP_PORT = process.env.EMAIL_PORT || process.env.SMTP_PORT || 587;
    
    if (!SMTP_USER || !SMTP_PASS) {
        console.log('SMTP не настроен, email не будет отправлен');
        return;
    }
    
    try {
        let customerName = "Покупатель";
        
        try {
            const encryption = require('../utils/encryption');
            
            if (user.first_name && user.first_name.includes('{"iv":')) {
                const decryptedFirstName = encryption.decryptFromDB(user.first_name);
                const decryptedLastName = encryption.decryptFromDB(user.last_name);
                customerName = `${decryptedFirstName} ${decryptedLastName}`;
            } else if (user.first_name && user.first_name.includes('encrypted=')) {
                const decryptedFirstName = encryption.decryptFromDB(user.first_name);
                const decryptedLastName = encryption.decryptFromDB(user.last_name);
                customerName = `${decryptedFirstName} ${decryptedLastName}`;
            } else {
                customerName = `${user.first_name || ''} ${user.last_name || ''}`.trim();
                if (!customerName) {
                    customerName = email.split('@')[0];
                }
            }
        } catch (decryptError) {
            console.error('Ошибка дешифрования имени пользователя:', decryptError);
            customerName = email.split('@')[0];
        }
        
        console.log('Попытка отправки email через SMTP...');
        console.log('To:', email);
        console.log('Customer name:', customerName);
        
        const transporter = nodemailer.createTransport({
            host: SMTP_HOST,
            port: SMTP_PORT,
            secure: false,
            auth: {
                user: SMTP_USER,
                pass: SMTP_PASS
            }
        });

        const itemsHtml = items.map(item => `
            <tr>
                <td style="border-bottom: 1px solid #eee; padding: 10px;">${item.product_name}</td>
                <td style="border-bottom: 1px solid #eee; padding: 10px; text-align: center;">${item.quantity} шт.</td>
                <td style="border-bottom: 1px solid #eee; padding: 10px; text-align: right;">${item.price.toLocaleString()} ₽</td>
                <td style="border-bottom: 1px solid #eee; padding: 10px; text-align: right;">${item.itemTotal.toLocaleString()} ₽</td>
            </tr>
        `).join('');

        const htmlContent = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                    .header { background: #3498db; color: white; padding: 20px; text-align: center; border-radius: 10px 10px 0 0; }
                    .content { background: #f8f9fa; padding: 20px; }
                    .footer { background: #2c3e50; color: white; padding: 20px; text-align: center; border-radius: 0 0 10px 10px; }
                    .table { width: 100%; border-collapse: collapse; margin: 20px 0; }
                    .table th { background: #2c3e50; color: white; padding: 10px; text-align: left; }
                    .total { font-size: 18px; font-weight: bold; color: #e74c3c; }
                    .order-number { font-size: 20px; font-weight: bold; color: #3498db; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>Магазин МПТ</h1>
                        <p>Товары с символикой Московского Приборостроительного Техникума</p>
                    </div>
                    
                    <div class="content">
                        <h2>Ваш заказ принят в обработку!</h2>
                        <p class="order-number">Заказ №${orderId}</p>
                        
                        <p><strong>Дата:</strong> ${new Date().toLocaleString('ru-RU')}</p>
                        <p><strong>Покупатель:</strong> ${customerName}</p>
                        
                        <table class="table">
                            <thead>
                                <tr>
                                    <th>Товар</th>
                                    <th>Кол-во</th>
                                    <th>Цена</th>
                                    <th>Сумма</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${itemsHtml}
                            </tbody>
                            <tfoot>
                                <tr>
                                    <td colspan="3" style="text-align: right; padding: 10px;"><strong>ИТОГО:</strong></td>
                                    <td class="total" style="padding: 10px;">${total.toLocaleString()} ₽</td>
                                </tr>
                            </tfoot>
                        </table>
                        
                        <p>Спасибо за покупку! 🎓</p>
                        <p><em>Детали заказа доступны в вашем личном кабинете в разделе "Мои заказы".</em></p>
                    </div>
                    
                    <div class="footer">
                        <p>Магазин МПТ © ${new Date().getFullYear()}</p>
                        <p>Все права защищены</p>
                    </div>
                </div>
            </body>
            </html>
        `;

        const mailOptions = {
            from: `${process.env.EMAIL_FROM || SMTP_USER}`,
            to: email,
            subject: `Заказ №${orderId} принят в обработку`,
            html: htmlContent,
            text: `Ваш заказ №${orderId} на сумму ${total} ₽ успешно принят в обработку. Детали в личном кабинете.`
        };

        const info = await transporter.sendMail(mailOptions);
        console.log(`✅ Email отправлен на ${email}, Message ID: ${info.messageId}`);
        
    } catch (error) {
        console.error('❌ Ошибка отправки email:', error.message);
        if (error.code) {
            console.error('Код ошибки:', error.code);
        }
        throw error;
    }

    }
    
    async getUserOrders(req, res) {
        try {
            const userId = req.user.userId;
            
            const result = await pool.query(`
                SELECT 
                    pr.pr_id as id,
                    pr.total,
                    ps.ps_name as status,
                    pr.phone,
                    pr.created_at,
                    pr.updated_at,
                    (
                        SELECT json_agg(
                            json_build_object(
                                'id', pi.pi_id,
                                'product_id', pi.product_id,
                                'product_name', p.product_name,
                                'quantity', pi.quantity,
                                'price', pi.price,
                                'total', pi.quantity * pi.price
                            )
                        )
                        FROM preorder_items pi
                        JOIN products p ON pi.product_id = p.product_id
                        WHERE pi.preorder_id = pr.pr_id
                    ) as items
                FROM preorders pr
                JOIN preorder_status ps ON pr.status_id = ps.ps_id
                WHERE pr.user_id = $1
                ORDER BY pr.created_at DESC
            `, [userId]);
            
            res.json(result.rows);
        } catch (error) {
            console.error('Ошибка получения предзаказов:', error);
            res.status(500).json({ error: 'Ошибка получения предзаказов' });
        }
    }

    async getOrderDetails(req, res) {
        try {
            const userId = req.user.userId;
            const { id } = req.params;
            
            const result = await pool.query(`
                SELECT 
                    pr.pr_id as id,
                    pr.total,
                    ps.ps_name as status,
                    pr.phone,
                    pr.created_at,
                    pr.updated_at
                FROM preorders pr
                JOIN preorder_status ps ON pr.status_id = ps.ps_id
                WHERE pr.pr_id = $1 AND pr.user_id = $2
            `, [id, userId]);
            
            if (result.rows.length === 0) {
                return res.status(404).json({ error: 'Заказ не найден' });
            }
            
            const order = result.rows[0];
            
            const itemsResult = await pool.query(`
                SELECT 
                    pi.pi_id as id,
                    pi.product_id,
                    p.product_name as name,
                    p.description,
                    pi.quantity,
                    pi.price,
                    (pi.quantity * pi.price) as total
                FROM preorder_items pi
                JOIN products p ON pi.product_id = p.product_id
                WHERE pi.preorder_id = $1
            `, [id]);
            
            order.items = itemsResult.rows;
            
            res.json(order);
        } catch (error) {
            console.error('Ошибка получения деталей заказа:', error);
            res.status(500).json({ error: 'Ошибка получения деталей заказа' });
        }
    }


async getAllOrders(req, res) {
    try {
        const encryption = require('../utils/encryption');
        const archive = req.query.archive === 'true';
        const archiveClause = archive
            ? `AND pr.created_at < NOW() - INTERVAL '${MERCHANDISER_ARCHIVE_DAYS} days'`
            : `AND pr.created_at >= NOW() - INTERVAL '${MERCHANDISER_ARCHIVE_DAYS} days'`;

        const result = await pool.query(`
            SELECT 
                pr.pr_id as id,
                pr.total,
                ps.ps_name as status,
                pr.phone,
                pr.created_at,
                pr.updated_at,
                u.email as customer_email,
                u.first_name,
                u.last_name,
                u.phone as customer_phone,
                (
                    SELECT COUNT(*) 
                    FROM preorder_items pi 
                    WHERE pi.preorder_id = pr.pr_id
                ) as items_count
            FROM preorders pr
            JOIN preorder_status ps ON pr.status_id = ps.ps_id
            JOIN users u ON pr.user_id = u.user_id
            WHERE 1=1
            ${archiveClause}
            ORDER BY pr.created_at DESC
        `);
        
        const ordersWithDecryptedNames = result.rows.map(order => {
            let customer_name = order.customer_email;
            let customer_phone = order.customer_phone;
            
            try {
                const decryptedFirstName = encryption.decryptFromDB(order.first_name);
                const decryptedLastName = encryption.decryptFromDB(order.last_name);
                customer_name = `${decryptedFirstName} ${decryptedLastName}`;
                
                const { first_name, last_name, ...orderWithoutNames } = order;
                return {
                    ...orderWithoutNames,
                    customer_name,
                    customer_phone
                };
            } catch (decryptError) {
                console.error('Ошибка дешифрования:', decryptError);
                const { first_name, last_name, ...orderWithoutNames } = order;
                return {
                    ...orderWithoutNames,
                    customer_name: order.customer_email,
                    customer_phone
                };
            }
        });
        
        res.json(ordersWithDecryptedNames);
    } catch (error) {
        console.error('Ошибка получения всех предзаказов:', error);
        res.status(500).json({ error: 'Ошибка получения предзаказов' });
    }
}

async updateOrderStatus(req, res) {
    try {
        const { id } = req.params;
        const { status } = req.body;

        if (!status) {
            return res.status(400).json({ error: 'Статус обязателен' });
        }

        const orderId = parseInt(id, 10);
        if (Number.isNaN(orderId)) {
            return res.status(400).json({ error: 'Некорректный ID заказа' });
        }

        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            const result = await executeOrderStatusUpdate(client, orderId, status, req.user.userId);
            await client.query('COMMIT');

            if (result.unchanged) {
                return res.json({
                    message: 'Статус уже установлен',
                    status: result.newStatusName
                });
            }

            return res.json({
                message: 'Статус заказа успешно обновлен',
                order: result.order,
                status: result.newStatusName
            });
        } catch (e) {
            await client.query('ROLLBACK');
            const msg = e.message || '';
            if (msg.includes('невозможен')) {
                return res.status(403).json({ error: msg });
            }
            if (
                msg.includes('Недостаточно') ||
                msg.includes('Неверный статус') ||
                msg.includes('не найден') ||
                msg.includes('Некорректный')
            ) {
                return res.status(400).json({ error: msg });
            }
            console.error('❌ Ошибка обновления статуса заказа:', e);
            return res.status(500).json({
                error: 'Ошибка обновления статуса заказа',
                details: msg
            });
        } finally {
            client.release();
        }
    } catch (error) {
        console.error('❌ Ошибка обновления статуса заказа:', error);
        return res.status(500).json({
            error: 'Ошибка обновления статуса заказа',
            details: error.message
        });
    }
}

async batchUpdateOrderStatus(req, res) {
    try {
        const { order_ids, status } = req.body;

        if (!Array.isArray(order_ids) || order_ids.length === 0) {
            return res.status(400).json({ error: 'Укажите непустой массив order_ids' });
        }
        if (!status) {
            return res.status(400).json({ error: 'Статус обязателен' });
        }

        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            let updated = 0;
            let skipped = 0;

            for (const rawId of order_ids) {
                const orderId = parseInt(rawId, 10);
                if (Number.isNaN(orderId)) {
                    throw new Error(`Некорректный ID заказа: ${rawId}`);
                }

                const result = await executeOrderStatusUpdate(
                    client,
                    orderId,
                    status,
                    req.user.userId
                );

                if (result.unchanged) {
                    skipped += 1;
                } else {
                    updated += 1;
                }
            }

            await client.query('COMMIT');

            return res.json({
                message:
                    updated > 0
                        ? `Обновлено заказов: ${updated}${skipped ? `, без изменений: ${skipped}` : ''}`
                        : `Все выбранные заказы уже в статусе «${status}»`,
                updated,
                skipped
            });
        } catch (e) {
            await client.query('ROLLBACK');
            const msg = e.message || '';
            if (msg.includes('невозможен')) {
                return res.status(403).json({ error: msg });
            }
            return res.status(400).json({ error: msg || 'Ошибка массового обновления' });
        } finally {
            client.release();
        }
    } catch (error) {
        console.error('❌ batchUpdateOrderStatus:', error);
        return res.status(500).json({ error: 'Ошибка массового обновления статусов' });
    }
}

async getOrderDetailsForMerchandiser(req, res) {
    try {
        const { id } = req.params;
        const encryption = require('../utils/encryption');
        
        const result = await pool.query(`
            SELECT 
                pr.pr_id as id,
                pr.total,
                ps.ps_name as status,
                pr.phone,
                pr.created_at,
                pr.updated_at,
                u.email as customer_email,
                u.first_name,
                u.last_name,
                u.phone as customer_phone
            FROM preorders pr
            JOIN preorder_status ps ON pr.status_id = ps.ps_id
            JOIN users u ON pr.user_id = u.user_id
            WHERE pr.pr_id = $1
        `, [id]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Заказ не найден' });
        }
        
        const order = result.rows[0];
        
        try {
            const decryptedFirstName = encryption.decryptFromDB(order.first_name);
            const decryptedLastName = encryption.decryptFromDB(order.last_name);
            order.customer_name = `${decryptedFirstName} ${decryptedLastName}`;
        } catch (decryptError) {
            console.error('Ошибка дешифрования:', decryptError);
            order.customer_name = order.customer_email;
        }
        
        delete order.first_name;
        delete order.last_name;
        
        const itemsResult = await pool.query(`
            SELECT 
                pi.pi_id as id,
                pi.product_id,
                p.product_name as name,
                p.description,
                pi.quantity,
                pi.price,
                (pi.quantity * pi.price) as total
            FROM preorder_items pi
            JOIN products p ON pi.product_id = p.product_id
            WHERE pi.preorder_id = $1
        `, [id]);
        
        order.items = itemsResult.rows;
        
        res.json(order);
    } catch (error) {
        console.error('Ошибка получения деталей заказа:', error);
        res.status(500).json({ error: 'Ошибка получения деталей заказа' });
    }
}

async getOrderStatuses(req, res) {
    try {
        const result = await pool.query(
            'SELECT ps_id as id, ps_name as name FROM preorder_status ORDER BY ps_id'
        );
        res.json(result.rows);
    } catch (error) {
        console.error('Ошибка получения статусов:', error);
        res.status(500).json({ error: 'Ошибка получения статусов' });
    }
}

}

module.exports = new OrderController();