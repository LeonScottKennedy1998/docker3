const pool = require('../config/database');
const nodemailer = require('nodemailer');

class OrderController {
    async createOrder(req, res) {
    try {
        const userId = req.user.userId;
        const { items, phone } = req.body;
        
        if (!items || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ error: 'Корзина пуста' });
        }
        
        let total = 0;
        const orderItems = [];
        
        for (const item of items) {
            const productResult = await pool.query(
                'SELECT product_id, price, stock, product_name FROM products WHERE product_id = $1 AND is_active = true',
                [item.productId]
            );
            
            if (productResult.rows.length === 0) {
                return res.status(400).json({ 
                    error: `Товар с ID ${item.productId} не найден` 
                });
            }
            
            const product = productResult.rows[0];
            
            if (product.stock < item.quantity) {
                return res.status(400).json({ 
                    error: `Недостаточно товара "${product.product_name}" на складе. Доступно: ${product.stock} шт.` 
                });
            }
            
            let itemPrice = product.price;
            
            const discountResult = await pool.query(`
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
        
        const userResult = await pool.query(
            'SELECT email, first_name, last_name FROM users WHERE user_id = $1',
            [userId]
        );
        
        if (userResult.rows.length === 0) {
            return res.status(404).json({ error: 'Пользователь не найден' });
        }
        
        const user = userResult.rows[0];
        
        const orderResult = await pool.query(
            `INSERT INTO preorders 
             (user_id, status_id, total, phone, created_at, updated_at)
             VALUES ($1, 1, $2, $3, NOW(), NOW())
             RETURNING pr_id as id, total, created_at`,
            [userId, total, phone || req.user.phone]
        );
        
        const orderId = orderResult.rows[0].id;
        
        for (const item of orderItems) {
            await pool.query(
                `INSERT INTO preorder_items 
                 (preorder_id, product_id, quantity, price)
                 VALUES ($1, $2, $3, $4)`,
                [orderId, item.product_id, item.quantity, item.price]
            );
            
            await pool.query(
                `UPDATE products 
                 SET stock = stock - $1
                 WHERE product_id = $2`,
                [item.quantity, item.product_id]
            );
        }
        
        await pool.query(
            `INSERT INTO audit_log 
             (user_id, audit_action, audit_table, table_id, new_data)
             VALUES ($1, 'CREATE_ORDER', 'preorders', $2, $3)`,
            [userId, orderId, JSON.stringify({ total, items_count: items.length })]
        );
        
        this.sendOrderEmail(user.email, orderId, total, orderItems, user)
            .catch(emailError => {
                console.error('Ошибка отправки email:', emailError);
            });
        
        res.status(201).json({
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
        console.error('Ошибка создания заказа:', error);
        res.status(500).json({ error: 'Ошибка создания заказа' });
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
        
        console.log('📢 Обновление статуса заказа:', { id, status });
        
        if (!status) {
            return res.status(400).json({ error: 'Статус обязателен' });
        }
        
        const statusResult = await pool.query(
            'SELECT ps_id FROM preorder_status WHERE ps_name = $1',
            [status]
        );
        
        if (statusResult.rows.length === 0) {
            return res.status(400).json({ error: 'Неверный статус' });
        }
        
        const statusId = statusResult.rows[0].ps_id;
        
        const currentOrder = await pool.query(
            'SELECT status_id, user_id FROM preorders WHERE pr_id = $1',
            [id]
        );
        
        if (currentOrder.rows.length === 0) {
            return res.status(404).json({ error: 'Заказ не найден' });
        }
        
        const oldStatusId = currentOrder.rows[0].status_id;
        const userId = currentOrder.rows[0].user_id;
        
        if (oldStatusId === statusId) {
            return res.json({ 
                message: 'Статус уже установлен', 
                status 
            });
        }
        
        const oldStatusResult = await pool.query(
            'SELECT ps_name FROM preorder_status WHERE ps_id = $1',
            [oldStatusId]
        );
        const oldStatusName = oldStatusResult.rows[0]?.ps_name || 'Неизвестно';
        
        const result = await pool.query(
            `UPDATE preorders 
             SET status_id = $1, updated_at = NOW()
             WHERE pr_id = $2
             RETURNING pr_id as id, total, updated_at`,
            [statusId, id]
        );
        
        const newStatusResult = await pool.query(
            'SELECT ps_name FROM preorder_status WHERE ps_id = $1',
            [statusId]
        );
        const newStatusName = newStatusResult.rows[0]?.ps_name || status;
        
        if (status === 'Подтвержден') {
            try {
                const items = await pool.query(
                    `SELECT pi.product_id, pi.quantity, p.product_name, p.stock
                     FROM preorder_items pi
                     JOIN products p ON pi.product_id = p.product_id
                     WHERE pi.preorder_id = $1`,
                    [id]
                );
                
                console.log('📦 Товары для резервирования:', items.rows);
                
                const insufficientItems = [];
                for (const item of items.rows) {
                    if (item.stock < item.quantity) {
                        insufficientItems.push({
                            product_id: item.product_id,
                            product_name: item.product_name,
                            required: item.quantity,
                            available: item.stock
                        });
                    }
                }
                
                if (insufficientItems.length > 0) {
                    console.error('❌ Недостаточно товаров:', insufficientItems);
                    await pool.query(
                        `UPDATE preorders 
                         SET status_id = $1, updated_at = NOW()
                         WHERE pr_id = $2`,
                        [oldStatusId, id]
                    );
                    return res.status(400).json({ 
                        error: `Недостаточно товаров на складе: ${insufficientItems.map(i => i.product_name).join(', ')}` 
                    });
                }
                
                for (const item of items.rows) {
                    const updateResult = await pool.query(
                        `UPDATE products 
                         SET stock = stock - $1
                         WHERE product_id = $2 AND stock >= $1
                         RETURNING product_id, product_name, stock`,
                        [item.quantity, item.product_id]
                    );
                    
                    if (updateResult.rows.length === 0) {
                        await pool.query(
                            `UPDATE preorders 
                             SET status_id = $1, updated_at = NOW()
                             WHERE pr_id = $2`,
                            [oldStatusId, id]
                        );
                        throw new Error(`Не удалось зарезервировать товар ${item.product_name}`);
                    }
                    
                    console.log(`✅ Товар зарезервирован: ${item.product_name} -${item.quantity} шт.`);
                }
                
                console.log('✅ Все товары успешно зарезервированы');
                
            } catch (reserveError) {
                console.error('❌ Ошибка резервирования товаров:', reserveError);
                await pool.query(
                    `UPDATE preorders 
                     SET status_id = $1, updated_at = NOW()
                     WHERE pr_id = $2`,
                    [oldStatusId, id]
                );
                return res.status(500).json({ 
                    error: 'Ошибка резервирования товаров',
                    details: reserveError.message 
                });
            }
        }
        
        if (oldStatusName === 'Подтвержден' && status !== 'Подтвержден') {
            try {
                const items = await pool.query(
                    `SELECT pi.product_id, pi.quantity, p.product_name
                     FROM preorder_items pi
                     JOIN products p ON pi.product_id = p.product_id
                     WHERE pi.preorder_id = $1`,
                    [id]
                );
                
                for (const item of items.rows) {
                    await pool.query(
                        `UPDATE products 
                         SET stock = stock + $1
                         WHERE product_id = $2`,
                        [item.quantity, item.product_id]
                    );
                    console.log(`↩️ Товар возвращен на склад: ${item.product_name} +${item.quantity} шт.`);
                }
            } catch (returnError) {
                console.error('❌ Ошибка возврата товаров:', returnError);
            }
        }
        
        await pool.query(
            `INSERT INTO audit_log 
             (user_id, audit_action, audit_table, table_id, old_data, new_data)
             VALUES ($1, 'UPDATE_ORDER_STATUS', 'preorders', $2, $3, $4)`,
            [req.user.userId, id, 
             JSON.stringify({ status: oldStatusName }),
             JSON.stringify({ status: newStatusName })]
        );
        
        res.json({
            message: 'Статус заказа успешно обновлен',
            order: result.rows[0],
            status: newStatusName
        });
        
    } catch (error) {
        console.error('❌ Ошибка обновления статуса заказа:', error);
        res.status(500).json({ 
            error: 'Ошибка обновления статуса заказа',
            details: error.message 
        });
    }
}

    async reserveProductsForOrder(orderId) {
    try {
        console.log('🛒 Резервирование товаров для заказа', orderId);
        
        const items = await pool.query(
            `SELECT pi.product_id, pi.quantity, p.product_name, p.stock
             FROM preorder_items pi
             JOIN products p ON pi.product_id = p.product_id
             WHERE pi.preorder_id = $1`,
            [orderId]
        );
        
        console.log('📦 Товары для резервирования:', items.rows);
        
        const insufficientItems = [];
        for (const item of items.rows) {
            if (item.stock < item.quantity) {
                insufficientItems.push({
                    product_id: item.product_id,
                    product_name: item.product_name,
                    required: item.quantity,
                    available: item.stock
                });
            }
        }
        
        if (insufficientItems.length > 0) {
            console.error('❌ Недостаточно товаров:', insufficientItems);
            throw new Error(`Недостаточно товаров на складе: ${JSON.stringify(insufficientItems)}`);
        }
        
        for (const item of items.rows) {
            const updateResult = await pool.query(
                `UPDATE products 
                 SET stock = stock - $1
                 WHERE product_id = $2 AND stock >= $1
                 RETURNING product_id, product_name, stock`,
                [item.quantity, item.product_id]
            );
            
            if (updateResult.rows.length === 0) {
                throw new Error(`Не удалось зарезервировать товар ${item.product_name}`);
            }
            
            console.log(`✅ Товар зарезервирован: ${item.product_name} -${item.quantity} шт.`);
        }
        
        await pool.query(
            `INSERT INTO audit_log 
             (audit_action, audit_table, table_id, new_data)
             VALUES ('RESERVE_PRODUCTS', 'preorders', $1, $2)`,
            [orderId, JSON.stringify({ 
                items_count: items.rows.length,
                items: items.rows.map(i => ({ 
                    product_id: i.product_id, 
                    quantity: i.quantity 
                }))
            })]
        );
        
        console.log('✅ Все товары успешно зарезервированы');
        
    } catch (error) {
        console.error('❌ Ошибка резервирования товаров:', error);
        throw error;
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


}

module.exports = new OrderController();