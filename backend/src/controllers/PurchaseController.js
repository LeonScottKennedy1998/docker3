const pool = require('../config/database');
const encryptionService = require('../utils/encryption');

const PROCUREMENT_ARCHIVE_DAYS = 30;


function assertPurchaseDeliveryTransition(currentId, nextId) {
    const cur = Number(currentId);
    const next = Number(nextId);
    if (cur === next) return;
    if (cur === 5) {
        throw new Error('Отменённую заявку нельзя изменить');
    }
    if (cur === 4) {
        throw new Error('Полученную заявку нельзя менять');
    }
    const allowed = { 1: [2, 5], 2: [3], 3: [4] };
    if (!allowed[cur] || !allowed[cur].includes(next)) {
        throw new Error('Недопустимый переход статуса');
    }
}

async function updateStockFromOrder(poId, isAddition = true) {
    try {
        const items = await pool.query(
            `SELECT product_id, quantity 
             FROM purchase_order_items 
             WHERE purchase_order_id = $1`,
            [poId]
        );
        
        for (const item of items.rows) {
            const quantityChange = isAddition ? item.quantity : -item.quantity;
            
            await pool.query(
                `UPDATE products 
                 SET stock = stock + $1, 
                     updated_at = NOW()
                 WHERE product_id = $2`,
                [quantityChange, item.product_id]
            );
            
            await pool.query(
                `INSERT INTO audit_log 
                 (audit_action, audit_table, table_id, new_data)
                 VALUES ($1, 'products', $2, $3)`,
                ['UPDATE_STOCK_FROM_ORDER', 
                 item.product_id, 
                 JSON.stringify({ 
                     quantity_change: quantityChange, 
                     po_id: poId,
                     operation: isAddition ? 'addition' : 'subtraction'
                 })]
            );
        }
        
        console.log(`✅ Остатки ${isAddition ? 'добавлены' : 'вычтены'} для заявки ${poId}`);
        
    } catch (error) {
        console.error('❌ Ошибка обновления остатков:', error);
        throw error;
    }
}

async function updateSupplierStats(supplierId) {
    try {
        await pool.query(`
            UPDATE suppliers s
            SET rating = COALESCE((
                SELECT CASE 
                    WHEN COUNT(*) > 0 THEN 
                        LEAST(5, GREATEST(1, 
                            (COUNT(CASE WHEN po.delivery_status_id = 4 THEN 1 END) * 3 + 
                             COUNT(CASE WHEN po.delivery_status_id IN (2,3) THEN 1 END) * 2) / 
                            GREATEST(COUNT(*), 1)
                        ))
                    ELSE 0
                END
                FROM purchase_orders po
                WHERE po.supplier_id = s.supplier_id
                AND po.delivery_status_id != 5
            ), 0)
            WHERE s.supplier_id = $1
        `, [supplierId]);
        
        console.log(`📊 Статистика поставщика ${supplierId} обновлена`);
        
    } catch (error) {
        console.error('❌ Ошибка обновления статистики поставщика:', error);
    }
}

async function updateSupplierRating(supplierId) {
    try {
        await pool.query(`
            UPDATE suppliers s
            SET rating = COALESCE((
                SELECT ROUND(AVG(sr.rating))
                FROM supplier_ratings sr
                WHERE sr.supplier_id = s.supplier_id
            ), 0)
            WHERE s.supplier_id = $1
        `, [supplierId]);
        
        console.log(`⭐ Рейтинг поставщика ${supplierId} обновлен на основе оценок`);
        
    } catch (error) {
        console.error('❌ Ошибка обновления рейтинга поставщика:', error);
    }
}

const PURCHASE_PACE_LABELS = {
    none: 'Нет продаж (в учётном периоде)',
    very_slow: 'Очень медленные продажи',
    slow: 'Медленные продажи',
    moderate: 'Умеренный спрос',
    fast: 'Хорошо продаётся'
};

function monthlyVelocityUnitsPerMonth(sold90, sold365) {
    const s90 = Number(sold90) || 0;
    const s365 = Number(sold365) || 0;
    if (s90 > 0) return s90 / 3;
    if (s365 > 0) return s365 / 12;
    return 0;
}

function salesPaceKey(monthly) {
    if (monthly <= 0) return 'none';
    if (monthly < 0.15) return 'very_slow';
    if (monthly < 0.85) return 'slow';
    if (monthly < 4) return 'moderate';
    return 'fast';
}

function recommendedQtyFromVelocity(stock, monthly, stockLevel) {
    const s = Number(stock) || 0;
    const m = Number(monthly) || 0;
    const critical = stockLevel === 'КРИТИЧЕСКИЙ';

    if (m < 0.12 && s > 0) {
        const piece = Math.min(8, Math.max(2, Math.ceil(m * 36) - s));
        return Math.max(1, piece);
    }

    const safety = m >= 4 ? 6 : m >= 1 ? 4 : m >= 0.2 ? 3 : 2;
    const monthsCover = m < 0.15 ? 6 : 4;
    const target = Math.ceil(m * monthsCover) + safety;
    let qty = Math.max(0, target - s);

    if (s === 0) {
        qty = Math.max(qty, m >= 0.85 ? 12 : m >= 0.25 ? 6 : 3);
    }
    if (critical && m >= 1.2 && qty < 10) qty = Math.max(qty, 10);

    return qty;
}

function procurementHintText(stockLevel, paceKey, monthly, stock, sold365, monthsCover) {
    const m = monthly;
    const s = stock;
    const cov = monthsCover != null && Number.isFinite(monthsCover) ? monthsCover : null;

    if (paceKey === 'none') {
        return 'За год нет продаж по заказам клиентов. Низкий остаток не всегда значит срочную крупную закупку — оцените спрос вручную или возьмите минимальную партию.';
    }
    if (paceKey === 'very_slow') {
        if (cov != null) {
            const monthsRounded = Math.round(Math.max(0.1, cov) * 10) / 10;
            return `При текущем темпе продаж запаса хватит примерно на ${monthsRounded} мес. Крупная закупка может привести к залёживанию — логичнее небольшая партия.`;
        }
        return 'Очень низкий темп продаж — разумна точечная закупка небольшой партии, а не опт на много месяцев вперёд.';
    }
    if (paceKey === 'slow') {
        return 'Товар продаётся умеренно редко. Ориентируйтесь на продажи за квартал и последнюю дату продажи, а не только на «критичный» остаток.';
    }
    if (paceKey === 'fast' && (stockLevel === 'КРИТИЧЕСКИЙ' || stockLevel === 'НИЗКИЙ')) {
        return 'Хорошая оборачиваемость — имеет смысл пополнить запас с небольшим запасом на пик спроса.';
    }
    if ((stockLevel === 'КРИТИЧЕСКИЙ' || stockLevel === 'НИЗКИЙ') && sold365 > 0) {
        return 'Следите за остатком: при низком складе и стабильных продажах лучше не затягивать с пополнением.';
    }
    return 'Совет основан на фактических продажах (предзаказы) и текущем остатке; решение за менеджером.';
}

function enrichPurchaseRecommendationRow(row) {
    const sold90 = Number(row.sold_90_days) || 0;
    const sold365 = Number(row.sold_365_days) || 0;
    const stock = Number(row.stock) || 0;
    const stockLevel = row.stock_level;
    const monthly = monthlyVelocityUnitsPerMonth(sold90, sold365);
    const paceKey = salesPaceKey(monthly);
    const monthsCover = monthly > 0.02 ? stock / monthly : null;

    let estimatedDays = 365;
    if (monthly > 0.02) {
        estimatedDays = Math.min(365, Math.max(1, Math.round((stock / monthly) * 30)));
    } else if (stock === 0) {
        estimatedDays = 0;
    }

    const recommendedQty = recommendedQtyFromVelocity(stock, monthly, stockLevel);

    let recommendation = 'ПЛАНОВАЯ ЗАКУПКА';
    if (stockLevel === 'КРИТИЧЕСКИЙ' && (paceKey === 'fast' || paceKey === 'moderate')) {
        recommendation = 'СРОЧНАЯ ЗАКУПКА';
    } else if (stockLevel === 'КРИТИЧЕСКИЙ' && (paceKey === 'very_slow' || paceKey === 'slow' || paceKey === 'none')) {
        recommendation = 'ТОЧЕЧНОЕ ПОПОЛНЕНИЕ';
    } else if (stockLevel === 'НИЗКИЙ') {
        recommendation = paceKey === 'fast' ? 'ПЛАНОВАЯ / УСКОРИТЬ' : 'ПЛАНОВАЯ ЗАКУПКА';
    } else {
        recommendation = 'ОСТАТОК ПОД КОНТРОЛЕМ';
    }

    const procurementHint = procurementHintText(stockLevel, paceKey, monthly, stock, sold365, monthsCover);

    return {
        ...row,
        sold_90_days: sold90,
        sold_365_days: sold365,
        monthly_velocity: Math.round(monthly * 100) / 100,
        sales_pace: paceKey,
        sales_pace_label: PURCHASE_PACE_LABELS[paceKey] || PURCHASE_PACE_LABELS.moderate,
        months_of_cover: monthsCover != null ? Math.round(monthsCover * 10) / 10 : null,
        estimated_usage_days: estimatedDays,
        recommended_qty: recommendedQty,
        recommendation,
        procurement_hint: procurementHint
    };
}


class PurchaseController {

    async getSuppliers(req, res) {
        try {
            const result = await pool.query(`
                SELECT 
                    s.*,
                    -- Количество завершенных заказов (статус 4)
                    COUNT(CASE WHEN po.delivery_status_id = 4 THEN 1 END) as completed_orders,
                    -- Количество отмененных заказов (статус 5)
                    COUNT(CASE WHEN po.delivery_status_id = 5 THEN 1 END) as cancelled_orders,
                    -- Общая сумма завершенных заказов
                    COALESCE(SUM(CASE WHEN po.delivery_status_id = 4 THEN po.total_amount END), 0) as total_revenue,
                    -- Средний чек только по завершенным заказам
                    CASE 
                        WHEN COUNT(CASE WHEN po.delivery_status_id = 4 THEN 1 END) > 0 
                        THEN COALESCE(
                            AVG(CASE WHEN po.delivery_status_id = 4 THEN po.total_amount END), 
                            0
                        )
                        ELSE 0
                    END as avg_order_amount,
                    -- Время с последнего заказа
                    MAX(po.created_at) as last_order_date
                FROM suppliers s
                LEFT JOIN purchase_orders po ON s.supplier_id = po.supplier_id
                GROUP BY s.supplier_id
                ORDER BY s.name
            `);
            
            res.json(result.rows);
        } catch (error) {
            console.error('❌ Ошибка получения поставщиков:', error);
            res.status(500).json({ error: 'Ошибка получения поставщиков' });
        }
    }
    
    async createSupplier(req, res) {
        try {
            const { name, contact_person, email, phone } = req.body;
            const userId = req.user.userId;
            
            if (!name) {
                return res.status(400).json({ error: 'Название поставщика обязательно' });
            }
            
            const result = await pool.query(
                `INSERT INTO suppliers 
                 (name, contact_person, email, phone, rating)
                 VALUES ($1, $2, $3, $4, 0)
                 RETURNING *`,
                [name, contact_person, email, phone]
            );
            
            await pool.query(
                `INSERT INTO audit_log 
                 (user_id, audit_action, audit_table, table_id, new_data)
                 VALUES ($1, 'CREATE_SUPPLIER', 'suppliers', $2, $3)`,
                [userId, result.rows[0].supplier_id, 
                 JSON.stringify({ name, contact_person, email })]
            );
            
            res.status(201).json({
                message: 'Поставщик создан',
                supplier: result.rows[0]
            });
            
        } catch (error) {
            console.error('Ошибка создания поставщика:', error);
            res.status(500).json({ error: 'Ошибка создания поставщика' });
        }
    }
    
    async updateSupplier(req, res) {
        try {
            const { supplierId } = req.params;
            const { name, contact_person, email, phone, is_active } = req.body;
            const userId = req.user.userId;
            
            const result = await pool.query(
                `UPDATE suppliers 
                 SET name = COALESCE($1, name),
                     contact_person = COALESCE($2, contact_person),
                     email = COALESCE($3, email),
                     phone = COALESCE($4, phone),
                     is_active = COALESCE($5, is_active)
                 WHERE supplier_id = $6
                 RETURNING *`,
                [name, contact_person, email, phone, is_active, supplierId]
            );
            
            if (result.rows.length === 0) {
                return res.status(404).json({ error: 'Поставщик не найден' });
            }
            
            await pool.query(
                `INSERT INTO audit_log 
                 (user_id, audit_action, audit_table, table_id, new_data)
                 VALUES ($1, 'UPDATE_SUPPLIER', 'suppliers', $2, $3)`,
                [userId, supplierId, 
                 JSON.stringify({ name, contact_person, email })]
            );
            
            res.json({
                message: 'Поставщик обновлен',
                supplier: result.rows[0]
            });
            
        } catch (error) {
            console.error('Ошибка обновления поставщика:', error);
            res.status(500).json({ error: 'Ошибка обновления поставщика' });
        }
    }
    
    async getPurchaseOrders(req, res) {
        try {
            const archive = req.query.archive === 'true';
            const archiveClause = archive
                ? `AND po.created_at < NOW() - INTERVAL '${PROCUREMENT_ARCHIVE_DAYS} days'`
                : `AND po.created_at >= NOW() - INTERVAL '${PROCUREMENT_ARCHIVE_DAYS} days'`;

            let statusClause = '';
            const params = [];
            const rawStatus = req.query.status_id;
            if (rawStatus !== undefined && rawStatus !== '') {
                const sid = parseInt(rawStatus, 10);
                if (!Number.isNaN(sid)) {
                    statusClause = ' AND po.delivery_status_id = $1';
                    params.push(sid);
                }
            }

            const result = await pool.query(
                `
                SELECT 
                    po.*,
                    s.name as supplier_name,
                    s.contact_person,
                    s.phone as supplier_phone,
                    ds.status_name,
                    u.first_name || ' ' || u.last_name as manager_name,
                    COUNT(poi.poi_id) as items_count
                FROM purchase_orders po
                JOIN suppliers s ON po.supplier_id = s.supplier_id
                JOIN delivery_status ds ON po.delivery_status_id = ds.status_id
                JOIN users u ON po.manager_id = u.user_id
                LEFT JOIN purchase_order_items poi ON po.po_id = poi.purchase_order_id
                WHERE 1=1
                ${archiveClause}
                ${statusClause}
                GROUP BY po.po_id, s.name, s.contact_person, s.phone, ds.status_name, u.first_name, u.last_name
                ORDER BY po.created_at DESC
            `,
                params
            );

            res.json(result.rows);
        } catch (error) {
            console.error('Ошибка получения заявок:', error);
            res.status(500).json({ error: 'Ошибка получения заявок' });
        }
    }
    
    async createPurchaseOrder(req, res) {
        try {
            const { supplier_id, items } = req.body;
            const userId = req.user.userId;
            
            if (!supplier_id || !items || items.length === 0) {
                return res.status(400).json({ 
                    error: 'Укажите поставщика и товары' 
                });
            }
            
            await pool.query('BEGIN');
            
            const poResult = await pool.query(
                `INSERT INTO purchase_orders 
                 (supplier_id, manager_id, total_amount, delivery_status_id)
                 VALUES ($1, $2, 0, 1) -- Статус 1 = "Отправлена поставщику"
                 RETURNING po_id, created_at`,
                [supplier_id, userId]
            );
            
            const poId = poResult.rows[0].po_id;
            let totalAmount = 0;
            
            for (const item of items) {
                const { product_id, quantity, unit_price } = item;
                
                const productCheck = await pool.query(
                    'SELECT product_name, price FROM products WHERE product_id = $1',
                    [product_id]
                );
                
                if (productCheck.rows.length === 0) {
                    await pool.query('ROLLBACK');
                    return res.status(400).json({ 
                        error: `Товар с ID ${product_id} не найден` 
                    });
                }
                
                await pool.query(
                    `INSERT INTO purchase_order_items 
                     (purchase_order_id, product_id, quantity, unit_price)
                     VALUES ($1, $2, $3, $4)`,
                    [poId, product_id, quantity, unit_price]
                );
                
                totalAmount += quantity * unit_price;
            }
            
            await pool.query(
                'UPDATE purchase_orders SET total_amount = $1 WHERE po_id = $2',
                [totalAmount, poId]
            );
            
            await pool.query('COMMIT');
            
            await pool.query(
                `INSERT INTO audit_log 
                 (user_id, audit_action, audit_table, table_id, new_data)
                 VALUES ($1, 'CREATE_PURCHASE_ORDER', 'purchase_orders', $2, $3)`,
                [userId, poId, 
                 JSON.stringify({ 
                     supplier_id, 
                     items_count: items.length,
                     total_amount: totalAmount 
                 })]
            );
            
            res.status(201).json({
                message: 'Заявка создана успешно',
                purchase_order: {
                    po_id: poId,
                    total_amount: totalAmount,
                    created_at: poResult.rows[0].created_at,
                    delivery_status_id: 1
                }
            });
            
        } catch (error) {
            await pool.query('ROLLBACK');
            console.error('❌ Ошибка создания заявки:', error);
            res.status(500).json({ error: 'Ошибка создания заявки' });
        }
    }
    
    
    async updateOrderStatus(req, res) {
        try {
            const { poId } = req.params;
            const { delivery_status_id, rating } = req.body;
            const userId = req.user.userId;
            
            if (!delivery_status_id) {
                return res.status(400).json({ error: 'Укажите статус' });
            }
            
            const currentOrder = await pool.query(
                `SELECT po.*, po.supplier_id 
                 FROM purchase_orders po
                 WHERE po.po_id = $1`,
                [poId]
            );
            
            if (currentOrder.rows.length === 0) {
                return res.status(404).json({ error: 'Заявка не найдена' });
            }
            
            const currentStatus = currentOrder.rows[0].delivery_status_id;
            const supplierId = currentOrder.rows[0].supplier_id;
            const nextStatus = parseInt(delivery_status_id, 10);

            try {
                assertPurchaseDeliveryTransition(currentStatus, nextStatus);
            } catch (validationError) {
                return res.status(400).json({ error: validationError.message });
            }
            
            await pool.query('BEGIN');
            
            const result = await pool.query(
                `UPDATE purchase_orders 
                 SET delivery_status_id = $1, updated_at = NOW()
                 WHERE po_id = $2
                 RETURNING *`,
                [nextStatus, poId]
            );
            
            if (nextStatus === 4 && rating) {
                const existingRating = await pool.query(
                    `SELECT * FROM supplier_ratings 
                     WHERE purchase_order_id = $1`,
                    [poId]
                );
                
                if (existingRating.rows.length === 0) {
                    await pool.query(
                        `INSERT INTO supplier_ratings 
                         (supplier_id, purchase_order_id, user_id, rating, created_at)
                         VALUES ($1, $2, $3, $4, NOW())`,
                        [supplierId, poId, userId, rating]
                    );
                    
                    console.log(`⭐ Сохранена оценка ${rating} для заявки ${poId}`);
                }
            }
            
            if (currentStatus === 4 && nextStatus !== 4) {
                console.log(`↩️ Вычитаем остатки (статус меняется с 4 на ${nextStatus})`);
                await updateStockFromOrder(poId, false);
            }
            else if (nextStatus === 4 && currentStatus !== 4) {
                console.log(`➕ Добавляем остатки (статус меняется на 4)`);
                await updateStockFromOrder(poId, true);
            }
            else if (nextStatus === 5 && currentStatus === 4) {
                console.log(`✖️ Отмена заявки - вычитаем остатки`);
                await updateStockFromOrder(poId, false);
            }
            
            await updateSupplierRating(supplierId);
            
            await pool.query('COMMIT');
            
            await pool.query(
                `INSERT INTO audit_log 
                 (user_id, audit_action, audit_table, table_id, new_data)
                 VALUES ($1, 'UPDATE_ORDER_STATUS', 'purchase_orders', $2, $3)`,
                [userId, poId, 
                 JSON.stringify({ 
                     from_status: currentStatus,
                     to_status: nextStatus,
                     supplier_id: supplierId,
                     rating: rating || null
                 })]
            );
            
            const supplierRating = await pool.query(
                `SELECT rating FROM suppliers WHERE supplier_id = $1`,
                [supplierId]
            );
            
            res.json({
                message: 'Статус обновлен',
                purchase_order: result.rows[0],
                supplier_rating: supplierRating.rows[0]?.rating || 0,
                stock_updated: (currentStatus === 4 && nextStatus !== 4) || 
                              (nextStatus === 4 && currentStatus !== 4)
            });
            
        } catch (error) {
            await pool.query('ROLLBACK');
            console.error('❌ Ошибка обновления статуса:', error);
            res.status(500).json({ error: 'Ошибка обновления статуса' });
        }
    }


    
async getOrderDetails(req, res) {
    try {
        const { poId } = req.params;
        
        const orderResult = await pool.query(`
            SELECT 
                po.*,
                s.name as supplier_name,
                s.contact_person,
                s.email as supplier_email,
                s.phone as supplier_phone,
                ds.status_name,
                u.first_name,
                u.last_name,
                u.patronymic
            FROM purchase_orders po
            JOIN suppliers s ON po.supplier_id = s.supplier_id
            JOIN delivery_status ds ON po.delivery_status_id = ds.status_id
            JOIN users u ON po.manager_id = u.user_id
            WHERE po.po_id = $1
        `, [poId]);
        
        if (orderResult.rows.length === 0) {
            return res.status(404).json({ error: 'Заявка не найдена' });
        }
        
        const order = orderResult.rows[0];
        
        let manager_name = 'Неизвестно';
        try {
            const firstName = order.first_name ? encryptionService.decryptFromDB(order.first_name) : '';
            const lastName = order.last_name ? encryptionService.decryptFromDB(order.last_name) : '';
            const patronymic = order.patronymic ? encryptionService.decryptFromDB(order.patronymic) : '';
            
            manager_name = `${lastName} ${firstName} ${patronymic}`.trim();
        } catch (error) {
            console.error('Ошибка дешифрования данных менеджера:', error);
            manager_name = 'Менеджер';
        }
        
        const itemsResult = await pool.query(`
            SELECT 
                poi.*,
                p.product_name,
                p.category_id,
                c.category_name,
                p.price as current_price
            FROM purchase_order_items poi
            JOIN products p ON poi.product_id = p.product_id
            JOIN categories c ON p.category_id = c.category_id
            WHERE poi.purchase_order_id = $1
            ORDER BY p.product_name
        `, [poId]);
        
        const response = {
            order: {
                po_id: order.po_id,
                supplier_id: order.supplier_id,
                supplier_name: order.supplier_name,
                contact_person: order.contact_person,
                supplier_email: order.supplier_email,
                supplier_phone: order.supplier_phone,
                manager_id: order.manager_id,
                manager_name: manager_name,
                delivery_status_id: order.delivery_status_id,
                status_name: order.status_name,
                total_amount: order.total_amount,
                created_at: order.created_at,
                updated_at: order.updated_at
            },
            items: itemsResult.rows
        };
        
        res.json(response);
        
    } catch (error) {
        console.error('Ошибка получения деталей заявки:', error);
        res.status(500).json({ error: 'Ошибка получения деталей заявки' });
    }
}

async getStockAnalysis(req, res) {
    try {
        const lowStockResult = await pool.query(`
            SELECT 
                p.product_id,
                p.product_name,
                p.stock,
                c.category_name,
                COALESCE(SUM(poi.quantity), 0) as last_purchase_qty,
                COALESCE(MAX(po.created_at), p.created_at) as last_purchase_date
            FROM products p
            JOIN categories c ON p.category_id = c.category_id
            LEFT JOIN purchase_order_items poi ON p.product_id = poi.product_id
            LEFT JOIN purchase_orders po ON poi.purchase_order_id = po.po_id
            WHERE p.is_active = true AND p.stock < 10
            GROUP BY p.product_id, p.product_name, p.stock, c.category_name, p.created_at
            ORDER BY p.stock ASC
            LIMIT 20
        `);
        
        const categoryStatsResult = await pool.query(`
            SELECT 
                c.category_id,
                c.category_name,
                COUNT(p.product_id) as product_count,
                COALESCE(SUM(p.stock), 0) as total_stock,
                COALESCE(AVG(p.stock::numeric), 0) as avg_stock,
                COALESCE(MIN(p.stock), 0) as min_stock,
                COALESCE(MAX(p.stock), 0) as max_stock
            FROM categories c
            LEFT JOIN products p ON c.category_id = p.category_id AND p.is_active = true
            GROUP BY c.category_id, c.category_name
            ORDER BY total_stock ASC
        `);
        
        res.json({
            low_stock: lowStockResult.rows,
            category_stats: categoryStatsResult.rows,
            summary: {
                low_stock_count: lowStockResult.rows.length,
                total_categories: categoryStatsResult.rows.length
            }
        });
        
    } catch (error) {
        console.error('Ошибка анализа склада:', error);
        res.status(500).json({ error: 'Ошибка анализа склада' });
    }
}

    async getPurchaseRecommendations(req, res) {
        try {
            const result = await pool.query(`
            WITH product_sales AS (
                SELECT 
                    pi.product_id,
                    COALESCE(SUM(CASE WHEN pr.created_at >= NOW() - INTERVAL '90 days' AND pr.status_id != 3 THEN pi.quantity ELSE 0 END), 0) AS sold_90_days,
                    COALESCE(SUM(CASE WHEN pr.created_at >= NOW() - INTERVAL '365 days' AND pr.status_id != 3 THEN pi.quantity ELSE 0 END), 0) AS sold_365_days,
                    MAX(CASE WHEN pr.status_id != 3 THEN pr.created_at END) AS last_sale_at,
                    COUNT(DISTINCT CASE WHEN pr.created_at >= NOW() - INTERVAL '365 days' AND pr.status_id != 3 THEN pr.pr_id END) AS orders_365_days
                FROM preorder_items pi
                INNER JOIN preorders pr ON pi.preorder_id = pr.pr_id
                GROUP BY pi.product_id
            )
            SELECT 
                p.product_id,
                p.product_name,
                p.stock,
                p.price,
                p.category_id,
                c.category_name,
                COALESCE(ps.sold_90_days, 0)::integer AS sold_90_days,
                COALESCE(ps.sold_365_days, 0)::integer AS sold_365_days,
                COALESCE(ps.orders_365_days, 0)::integer AS orders_365_days,
                ps.last_sale_at,
                14 AS avg_lead_time,
                CASE 
                    WHEN p.stock <= 5 THEN 'КРИТИЧЕСКИЙ'
                    WHEN p.stock <= 10 THEN 'НИЗКИЙ'
                    WHEN p.stock <= 20 THEN 'НОРМАЛЬНЫЙ'
                    ELSE 'ВЫСОКИЙ'
                END AS stock_level
            FROM products p
            JOIN categories c ON p.category_id = c.category_id
            LEFT JOIN product_sales ps ON p.product_id = ps.product_id
            WHERE p.is_active = true AND p.stock <= 20
            ORDER BY 
                CASE 
                    WHEN p.stock <= 5 THEN 1
                    WHEN p.stock <= 10 THEN 2
                    ELSE 3
                END,
                COALESCE(ps.sold_90_days, 0) DESC NULLS LAST,
                p.stock ASC
            LIMIT 40
            `);

            const enriched = result.rows.map(enrichPurchaseRecommendationRow);
            console.log('Рекомендации найдены:', enriched.length);
            res.json(enriched);
        } catch (error) {
            console.error('Ошибка получения рекомендаций:', error);
            res.status(500).json({ error: 'Ошибка получения рекомендаций' });
        }
    }

    async getDeliveryStatuses(req, res) {
        try {
            const result = await pool.query('SELECT * FROM delivery_status ORDER BY status_id');
            res.json(result.rows);
        } catch (error) {
            console.error('Ошибка получения статусов:', error);
            res.status(500).json({ error: 'Ошибка получения статусов' });
        }
    }

    async getPurchaseReport(req, res) {
        try {
            const { start_date, end_date } = req.query;
            
            let query = `
                SELECT 
                    DATE(po.created_at) as purchase_date,
                    s.name as supplier_name,
                    COUNT(DISTINCT po.po_id) as order_count,
                    COUNT(poi.poi_id) as items_count,
                    SUM(poi.quantity) as total_quantity,
                    SUM(poi.quantity * poi.unit_price) as total_amount,
                    ROUND(AVG(poi.unit_price), 2) as avg_unit_price
                FROM purchase_orders po
                JOIN suppliers s ON po.supplier_id = s.supplier_id
                JOIN purchase_order_items poi ON po.po_id = poi.purchase_order_id
                WHERE po.delivery_status_id != 5
            `;
            
            const params = [];
            let paramIndex = 1;
            
            if (start_date) {
                query += ` AND po.created_at >= $${paramIndex}`;
                params.push(start_date);
                paramIndex++;
            }
            
            if (end_date) {
                query += ` AND po.created_at <= $${paramIndex}`;
                params.push(end_date);
                paramIndex++;
            }
            
            query += `
                GROUP BY DATE(po.created_at), s.name
                ORDER BY purchase_date DESC, total_amount DESC
            `;
            
            const result = await pool.query(query, params);
            
            res.json({
                report: result.rows,
                summary: {
                    total_orders: result.rows.reduce((sum, row) => sum + row.order_count, 0),
                    total_items: result.rows.reduce((sum, row) => sum + row.items_count, 0),
                    total_quantity: result.rows.reduce((sum, row) => sum + row.total_quantity, 0),
                    total_amount: result.rows.reduce((sum, row) => sum + parseFloat(row.total_amount), 0)
                }
            });
            
        } catch (error) {
            console.error('Ошибка получения отчета:', error);
            res.status(500).json({ error: 'Ошибка получения отчета' });
        }
    }
}

module.exports = new PurchaseController();