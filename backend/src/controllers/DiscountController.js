const pool = require('../config/database');

class DiscountController {
    async setDiscount(req, res) {
        try {
            const { productId } = req.params;
            const { discount_percent, end_date } = req.body;
            const userId = req.user.userId;

            if (!discount_percent || discount_percent < 0 || discount_percent > 100) {
                return res.status(400).json({ 
                    error: 'Процент скидки должен быть от 0 до 100' 
                });
            }

            const productResult = await pool.query(
                'SELECT product_id, product_name FROM products WHERE product_id = $1',
                [productId]
            );

            if (productResult.rows.length === 0) {
                return res.status(404).json({ error: 'Товар не найден' });
            }

            const product = productResult.rows[0];

            const existingDiscount = await pool.query(
                `SELECT discount_id FROM discounts 
                 WHERE product_id = $1 
                 AND (end_date IS NULL OR end_date > NOW())`,
                [productId]
            );

            let result;
            if (existingDiscount.rows.length > 0) {
                result = await pool.query(
                    `UPDATE discounts 
                     SET discount_percent = $1, end_date = $2, created_at = NOW()
                     WHERE product_id = $3 
                     AND (end_date IS NULL OR end_date > NOW())
                     RETURNING discount_id, discount_percent, start_date, end_date`,
                    [discount_percent, end_date || null, productId]
                );
            } else {
                result = await pool.query(
                    `INSERT INTO discounts 
                     (product_id, discount_percent, start_date, end_date)
                     VALUES ($1, $2, NOW(), $3)
                     RETURNING discount_id, discount_percent, start_date, end_date`,
                    [productId, discount_percent, end_date || null]
                );
            }

            
            await pool.query(
                `INSERT INTO audit_log 
                 (user_id, audit_action, audit_table, table_id, new_data)
                 VALUES ($1, 'SET_DISCOUNT', 'discounts', $2, $3)`,
                [userId, result.rows[0].discount_id, 
                 JSON.stringify({ 
                     product_id: productId,
                     discount_percent: discount_percent,
                     end_date: end_date,
                     product_name: product.product_name
                 })]
            );

            res.json({
                message: 'Скидка успешно установлена',
                discount: result.rows[0],
                product_name: product.product_name
            });

        } catch (error) {
            console.error('Ошибка установки скидки:', error);
            res.status(500).json({ error: 'Ошибка установки скидки' });
        }
    }

    async removeDiscount(req, res) {
        try {
            const { productId } = req.params;
            const userId = req.user.userId;

            const discountResult = await pool.query(
                `SELECT discount_id, discount_percent FROM discounts 
                 WHERE product_id = $1 
                 AND (end_date IS NULL OR end_date > NOW())`,
                [productId]
            );

            if (discountResult.rows.length === 0) {
                return res.status(404).json({ error: 'Активная скидка не найдена' });
            }

            const result = await pool.query(
                `UPDATE discounts 
                 SET end_date = NOW() - INTERVAL '1 day'
                 WHERE product_id = $1 
                 AND (end_date IS NULL OR end_date > NOW())
                 RETURNING discount_id`,
                [productId]
            );

            await pool.query(
                `INSERT INTO audit_log 
                 (user_id, audit_action, audit_table, table_id)
                 VALUES ($1, 'REMOVE_DISCOUNT', 'discounts', $2)`,
                [userId, result.rows[0].discount_id]
            );

            res.json({
                message: 'Скидка успешно удалена'
            });

        } catch (error) {
            console.error('Ошибка удаления скидки:', error);
            res.status(500).json({ error: 'Ошибка удаления скидки' });
        }
    }

    async getAllDiscounts(req, res) {
        try {
            const result = await pool.query(`
                SELECT 
                    d.discount_id,
                    d.discount_percent,
                    d.start_date,
                    d.end_date,
                    d.created_at,
                    p.product_id,
                    p.product_name,
                    p.price,
                    c.category_name,
                    CASE 
                        WHEN d.end_date IS NULL THEN 'Бессрочная'
                        WHEN d.end_date > NOW() THEN 'Активная'
                        ELSE 'Истекшая'
                    END as status
                FROM discounts d
                JOIN products p ON d.product_id = p.product_id
                JOIN categories c ON p.category_id = c.category_id
                WHERE d.end_date IS NULL OR d.end_date > NOW()
                ORDER BY d.created_at DESC
            `);

            const discounts = result.rows.map(item => {
                const finalPrice = item.price * (1 - item.discount_percent / 100);
                return {
                    ...item,
                    final_price: Math.round(finalPrice * 100) / 100
                };
            });

            res.json(discounts);

        } catch (error) {
            console.error('Ошибка получения скидок:', error);
            res.status(500).json({ error: 'Ошибка получения скидок' });
        }
    }

    async getProductDiscount(req, res) {
        try {
            const { productId } = req.params;

            const result = await pool.query(`
                SELECT 
                    d.discount_id,
                    d.discount_percent,
                    d.start_date,
                    d.end_date,
                    p.product_name,
                    p.price,
                    CASE 
                        WHEN d.end_date IS NULL THEN 'Бессрочная'
                        WHEN d.end_date > NOW() THEN 'Активная'
                        ELSE 'Истекшая'
                    END as status
                FROM discounts d
                JOIN products p ON d.product_id = p.product_id
                WHERE d.product_id = $1 
                AND (d.end_date IS NULL OR d.end_date > NOW())
                ORDER BY d.created_at DESC
                LIMIT 1
            `, [productId]);

            if (result.rows.length === 0) {
                return res.status(404).json({ 
                    message: 'Активная скидка не найдена',
                    has_discount: false 
                });
            }

            const discount = result.rows[0];
            const finalPrice = discount.price * (1 - discount.discount_percent / 100);

            res.json({
                ...discount,
                final_price: Math.round(finalPrice * 100) / 100,
                has_discount: true
            });

        } catch (error) {
            console.error('Ошибка получения скидки:', error);
            res.status(500).json({ error: 'Ошибка получения скидки' });
        }
    }
    async createRule(req, res) {
        try {
            const { 
                rule_name, 
                rule_type, 
                condition_value, 
                discount_percent, 
                priority, 
                start_date, 
                end_date 
            } = req.body;
            const userId = req.user.userId;

            if (!rule_name || !rule_type || !discount_percent) {
                return res.status(400).json({ 
                    error: 'Заполните обязательные поля' 
                });
            }

            let conditionJson = null;
            try {
                if (condition_value) {
                    conditionJson = typeof condition_value === 'string' 
                        ? condition_value 
                        : JSON.stringify(condition_value);
                }
            } catch (err) {
                return res.status(400).json({ 
                    error: 'Неверный формат условий (должен быть JSON)' 
                });
            }

            const result = await pool.query(
                `INSERT INTO discount_rules 
                 (rule_name, rule_type, condition_value, discount_percent, priority, start_date, end_date)
                 VALUES ($1, $2, $3, $4, $5, $6, $7)
                 RETURNING *`,
                [
                    rule_name, 
                    rule_type, 
                    conditionJson,
                    discount_percent, 
                    priority || 1,
                    start_date || new Date(),
                    end_date
                ]
            );

            await pool.query(
                `INSERT INTO audit_log 
                 (user_id, audit_action, audit_table, table_id, new_data)
                 VALUES ($1, 'CREATE_DISCOUNT_RULE', 'discount_rules', $2, $3)`,
                [userId, result.rows[0].rule_id, 
                 JSON.stringify({ rule_name, rule_type, discount_percent })]
            );

            res.status(201).json({
                message: 'Правило создано успешно',
                rule: result.rows[0]
            });

        } catch (error) {
            console.error('Ошибка создания правила:', error);
            res.status(500).json({ error: 'Ошибка создания правила' });
        }
    }

    async getRules(req, res) {
    try {
        const result = await pool.query(`
            SELECT 
                rule_id,
                rule_name,
                rule_type,
                condition_value,
                discount_percent,
                priority,
                start_date,
                end_date,
                is_active,
                created_at,
                last_applied,
                CASE 
                    WHEN end_date IS NULL THEN 'Бессрочное'
                    WHEN end_date > NOW() THEN 'Активно'
                    ELSE 'Истекло'
                END as status,
                (SELECT COUNT(*) FROM discounts 
                 WHERE discounts.rule_id = discount_rules.rule_id) as applied_count
            FROM discount_rules
            ORDER BY 
                CASE 
                    WHEN is_active = true AND (end_date IS NULL OR end_date > NOW()) THEN 1
                    WHEN is_active = false THEN 2
                    ELSE 3
                END ASC,
                priority DESC,
                created_at DESC
        `);

        const rules = result.rows.map(rule => {
            let parsedCondition = {};
            try {
                if (rule.condition_value) {
                      
                    if (typeof rule.condition_value === 'string') {
                        parsedCondition = JSON.parse(rule.condition_value);
                    } else {
                        parsedCondition = rule.condition_value;
                    }
                }
            } catch (err) {
                console.error(`Error parsing condition_value for rule ${rule.rule_id}:`, err);
                parsedCondition = {};
            }
            
            return {
                ...rule,
                condition_value: parsedCondition
            };
        });

        res.json(rules);

    } catch (error) {
        console.error('Ошибка получения правил:', error);
        res.status(500).json({ error: 'Ошибка получения правил' });
    }
}

    async applyRule(req, res) {
    try {
        const { ruleId } = req.params;
        const userId = req.user.userId;

        const ruleResult = await pool.query(
            `SELECT * FROM discount_rules 
             WHERE rule_id = $1 AND is_active = true`,
            [ruleId]
        );

        if (ruleResult.rows.length === 0) {
            return res.status(404).json({ error: 'Правило не найдено или неактивно' });
        }

        const rule = ruleResult.rows[0];
        let condition = {};
        if (rule.condition_value) {
            try {
                condition = typeof rule.condition_value === 'string' 
                    ? JSON.parse(rule.condition_value) 
                    : rule.condition_value;
            } catch (err) {
                console.error('Ошибка парсинга условий:', err);
            }
        }

        let baseQuery = `
            SELECT product_id 
            FROM products 
            WHERE is_active = true
        `;
        const params = [];
        let paramIndex = 1;

        switch (rule.rule_type) {
            case 'category':
                if (condition.category_id) {
                    baseQuery += ` AND category_id = $${paramIndex}`;
                    params.push(condition.category_id);
                    paramIndex++;
                }
                break;
            
            case 'stock':
                if (condition.min_stock !== undefined) {
                    baseQuery += ` AND stock >= $${paramIndex}`;
                    params.push(condition.min_stock);
                    paramIndex++;
                }
                if (condition.max_stock !== undefined) {
                    baseQuery += ` AND stock <= $${paramIndex}`;
                    params.push(condition.max_stock);
                    paramIndex++;
                }
                break;
            
            case 'age':
                if (condition.min_days_in_stock) {
                    baseQuery += ` AND created_at <= NOW() - INTERVAL '${condition.min_days_in_stock} days'`;
                }
                break;
            
            case 'price_range':
                if (condition.min_price !== undefined) {
                    baseQuery += ` AND price >= $${paramIndex}`;
                    params.push(condition.min_price);
                    paramIndex++;
                }
                if (condition.max_price !== undefined) {
                    baseQuery += ` AND price <= $${paramIndex}`;
                    params.push(condition.max_price);
                    paramIndex++;
                }
                break;
            
            case 'seasonal':{
                const month = new Date().getMonth() + 1;
                if (month >= 11 || month <= 2) {
                    baseQuery += ` AND category_id IN (1)`;
                }
                break;
            }
            case 'new_arrivals':
                baseQuery += ` AND created_at >= NOW() - INTERVAL '7 days'`;
                break;
        }

        const productsResult = await pool.query(baseQuery, params);
        const productIds = productsResult.rows.map(row => row.product_id);

        if (productIds.length === 0) {
            return res.json({ 
                message: 'Нет товаров, соответствующих условиям правила',
                applied_count: 0,
                skipped_count: 0
            });
        }

        let appliedCount = 0;
        let skippedCount = 0;

        for (const productId of productIds) {
            const currentDiscount = await pool.query(`
                SELECT 
                    d.discount_id,
                    d.rule_id,
                    COALESCE(r.priority, 0) as current_priority
                FROM discounts d
                LEFT JOIN discount_rules r ON d.rule_id = r.rule_id
                WHERE d.product_id = $1 
                AND (d.end_date IS NULL OR d.end_date > NOW())
                LIMIT 1
            `, [productId]);

            const hasCurrentDiscount = currentDiscount.rows.length > 0;
            const currentPriority = hasCurrentDiscount ? 
                (currentDiscount.rows[0].current_priority || 0) : 0;

            
            if (rule.priority > currentPriority) {
                if (hasCurrentDiscount) {
                    await pool.query(
                        `UPDATE discounts 
                         SET discount_percent = $1, 
                             rule_id = $2,
                             start_date = NOW(),
                             end_date = $3
                         WHERE product_id = $4 
                         AND (end_date IS NULL OR end_date > NOW())`,
                        [rule.discount_percent, rule.rule_id, rule.end_date, productId]
                    );
                } else {
                    await pool.query(
                        `INSERT INTO discounts 
                         (product_id, discount_percent, rule_id, start_date, end_date)
                         VALUES ($1, $2, $3, NOW(), $4)`,
                        [productId, rule.discount_percent, rule.rule_id, rule.end_date]
                    );
                }
                appliedCount++;
            } else if (rule.priority === currentPriority && hasCurrentDiscount) {
                if (currentDiscount.rows[0].rule_id === rule.rule_id) {
                    await pool.query(
                        `UPDATE discounts 
                         SET discount_percent = $1,
                             start_date = NOW(),
                             end_date = $2
                         WHERE product_id = $3 
                         AND (end_date IS NULL OR end_date > NOW())`,
                        [rule.discount_percent, rule.end_date, productId]
                    );
                    appliedCount++;
                } else {
                    skippedCount++;
                }
            } else {
                skippedCount++;
            }
        }
        
        await pool.query(
            `UPDATE discount_rules SET last_applied = NOW() WHERE rule_id = $1`,
            [ruleId]
        );

        await pool.query(
            `INSERT INTO audit_log 
             (user_id, audit_action, audit_table, table_id, new_data)
             VALUES ($1, 'APPLY_DISCOUNT_RULE', 'discount_rules', $2, $3)`,
            [userId, ruleId, 
             JSON.stringify({ 
                 applied_count: appliedCount,
                 skipped_count: skippedCount,
                 rule_name: rule.rule_name,
                 rule_priority: rule.priority
             })]
        );

        res.json({
            message: 'Правило успешно применено',
            applied_count: appliedCount,
            skipped_count: skippedCount,
            total_products: productIds.length,
            note: skippedCount > 0 ? 
                `${skippedCount} товаров не затронуто из-за более высоких приоритетов` : null
        });

    } catch (error) {
        console.error('Ошибка применения правила:', error);
        res.status(500).json({ error: 'Ошибка применения правила' });
    }
}

    async toggleRule(req, res) {
        try {
            const { ruleId } = req.params;
            const { is_active } = req.body;
            const userId = req.user.userId;

            const result = await pool.query(
                `UPDATE discount_rules 
                 SET is_active = $1
                 WHERE rule_id = $2
                 RETURNING rule_id, rule_name, is_active`,
                [is_active, ruleId]
            );

            if (result.rows.length === 0) {
                return res.status(404).json({ error: 'Правило не найдено' });
            }

            await pool.query(
                `INSERT INTO audit_log 
                 (user_id, audit_action, audit_table, table_id, new_data)
                 VALUES ($1, $2, 'discount_rules', $3, $4)`,
                [userId, 
                 is_active ? 'ENABLE_DISCOUNT_RULE' : 'DISABLE_DISCOUNT_RULE',
                 ruleId, 
                 JSON.stringify({ rule_name: result.rows[0].rule_name })]
            );

            res.json({
                message: `Правило ${is_active ? 'включено' : 'выключено'}`,
                rule: result.rows[0]
            });

        } catch (error) {
            console.error('Ошибка изменения статуса правила:', error);
            res.status(500).json({ error: 'Ошибка изменения статуса правила' });
        }
    }

    async deleteRule(req, res) {
        try {
            const { ruleId } = req.params;
            const userId = req.user.userId;

            const result = await pool.query(
                `DELETE FROM discount_rules 
                 WHERE rule_id = $1
                 RETURNING rule_id, rule_name`,
                [ruleId]
            );

            if (result.rows.length === 0) {
                return res.status(404).json({ error: 'Правило не найдено' });
            }

            await pool.query(
                `INSERT INTO audit_log 
                 (user_id, audit_action, audit_table, table_id)
                 VALUES ($1, 'DELETE_DISCOUNT_RULE', 'discount_rules', $2)`,
                [userId, ruleId]
            );

            res.json({
                message: 'Правило удалено',
                rule_name: result.rows[0].rule_name
            });

        } catch (error) {
            console.error('Ошибка удаления правила:', error);
            res.status(500).json({ error: 'Ошибка удаления правила' });
        }
    }


async previewRule(req, res) {
    try {
        console.log('🔄 previewRule вызван для ruleId:', req.params.ruleId);
        
        const { ruleId } = req.params;
        
        const ruleResult = await pool.query(
            `SELECT * FROM discount_rules WHERE rule_id = $1`,
            [ruleId]
        );

        console.log('📊 Найдено правил:', ruleResult.rows.length);
        
        if (ruleResult.rows.length === 0) {
            console.log('❌ Правило не найдено');
            return res.status(404).json({ error: 'Правило не найдено' });
        }

        const rule = ruleResult.rows[0];
        console.log('📋 Правило:', {
            id: rule.rule_id,
            name: rule.rule_name,
            type: rule.rule_type,
            condition: rule.condition_value
        });
        
        let condition = {};
        if (rule.condition_value) {
            try {
                console.log('🔍 Парсинг condition_value:', 
                    typeof rule.condition_value, 
                    rule.condition_value?.substring?.(0, 100));
                    
                condition = typeof rule.condition_value === 'string' 
                    ? JSON.parse(rule.condition_value) 
                    : rule.condition_value;
                    
                console.log('✅ Условия распарсены:', condition);
            } catch (err) {
                console.error('❌ Ошибка парсинга условий:', err);
                condition = {};
            }
        }

        let baseQuery = `
            SELECT 
                p.product_id,
                p.product_name,
                p.price,
                p.stock,
                p.created_at,
                c.category_name,
                COALESCE(d.discount_percent, 0) as current_discount
            FROM products p
            JOIN categories c ON p.category_id = c.category_id
            LEFT JOIN discounts d ON p.product_id = d.product_id 
                AND (d.end_date IS NULL OR d.end_date > NOW())
            WHERE p.is_active = true
        `;
        const params = [];
        let paramIndex = 1;
        
        console.log('🔍 Тип правила:', rule.rule_type);
        console.log('🔍 Условия:', condition);

        switch (rule.rule_type) {
            case 'category':
                if (condition.category_id) {
                    baseQuery += ` AND p.category_id = $${paramIndex}`;
                    params.push(condition.category_id);
                    paramIndex++;
                    console.log('✅ Добавлено условие категории:', condition.category_id);
                }
                break;
            
            case 'stock':
                if (condition.min_stock !== undefined) {
                    baseQuery += ` AND p.stock >= $${paramIndex}`;
                    params.push(condition.min_stock);
                    paramIndex++;
                }
                if (condition.max_stock !== undefined) {
                    baseQuery += ` AND p.stock <= $${paramIndex}`;
                    params.push(condition.max_stock);
                    paramIndex++;
                }
                break;
            
            case 'age':
                if (condition.min_days_in_stock) {
                    baseQuery += ` AND p.created_at <= NOW() - INTERVAL '${condition.min_days_in_stock} days'`;
                    console.log('✅ Добавлено условие возраста:', condition.min_days_in_stock, 'дней');
                }
                break;
            
            case 'price_range':
                if (condition.min_price !== undefined) {
                    baseQuery += ` AND p.price >= $${paramIndex}`;
                    params.push(condition.min_price);
                    paramIndex++;
                }
                if (condition.max_price !== undefined) {
                    baseQuery += ` AND p.price <= $${paramIndex}`;
                    params.push(condition.max_price);
                    paramIndex++;
                }
                break;
            
            case 'seasonal':
                const month = new Date().getMonth() + 1;
                console.log('📅 Текущий месяц:', month);
                if (month >= 11 || month <= 2) {
                    baseQuery += ` AND p.category_id IN (1)`;
                    console.log('✅ Добавлено сезонное условие (зима)');
                }
                break;
            
            case 'new_arrivals':
                baseQuery += ` AND p.created_at >= NOW() - INTERVAL '7 days'`;
                console.log('✅ Добавлено условие новинок');
                break;
                
            default:
                console.log('⚠️ Неизвестный тип правила:', rule.rule_type);
        }

        baseQuery += ` ORDER BY p.product_name LIMIT 50`;
        
        console.log('📝 Итоговый SQL запрос:', baseQuery);
        console.log('📝 Параметры:', params);

        const result = await pool.query(baseQuery, params);
        
        console.log('✅ Найдено товаров:', result.rows.length);

        const products = result.rows.map(product => {
            const finalPrice = product.price * (1 - rule.discount_percent / 100);
            return {
                ...product,
                new_price: Math.round(finalPrice * 100) / 100,
                new_discount: rule.discount_percent,
                price_change: product.price - finalPrice
            };
        });

        console.log('📤 Отправка ответа...');
        
        res.json({
            rule: {
                rule_id: rule.rule_id,
                name: rule.rule_name,
                discount_percent: rule.discount_percent,
                type: rule.rule_type,
                rule_name: rule.rule_name
            },
            products,
            total_count: result.rows.length
        });

    } catch (error) {
        console.error('❌ Ошибка предпросмотра правила:', error);
        console.error('❌ Stack trace:', error.stack);
        res.status(500).json({ 
            error: 'Ошибка предпросмотра правила',
            details: error.message 
        });
    }
}

    async updateRule(req, res) {
    try {
        const { ruleId } = req.params;
        const { 
            rule_name, 
            rule_type, 
            condition_value, 
            discount_percent, 
            priority, 
            is_active,
            start_date, 
            end_date 
        } = req.body;
        const userId = req.user.userId;

        console.log('Update rule raw data:', {
            ruleId,
            rule_name,
            rule_type,
            condition_value_type: typeof condition_value,
            condition_value_sample: typeof condition_value === 'string' ? 
                condition_value.substring(0, 100) : condition_value,
            discount_percent,
            priority
        });

        const existingRule = await pool.query(
            'SELECT * FROM discount_rules WHERE rule_id = $1',
            [ruleId]
        );

        if (existingRule.rows.length === 0) {
            return res.status(404).json({ error: 'Правило не найдено' });
        }

        const rule = existingRule.rows[0];
        
        let processedEndDate = end_date;
        if (end_date === '' || end_date === null) {
            processedEndDate = null;
        }

        let conditionJson = condition_value;
        
        if (condition_value && typeof condition_value === 'object') {
            try {
                conditionJson = JSON.stringify(condition_value);
            } catch (err) {
                console.error('Error stringifying condition_value:', err);
                conditionJson = rule.condition_value;
            }
        }
        else if (condition_value === null || condition_value === undefined) {
            conditionJson = rule.condition_value;
        }

        const updateData = {
            rule_name: rule_name || rule.rule_name,
            rule_type: rule_type || rule.rule_type,
            condition_value: conditionJson,
            discount_percent: discount_percent !== undefined ? 
                parseInt(discount_percent) : rule.discount_percent,
            priority: priority !== undefined ? 
                parseInt(priority) : rule.priority,
            is_active: is_active !== undefined ? 
                Boolean(is_active) : rule.is_active,
            start_date: start_date || rule.start_date,
            end_date: end_date !== undefined ? 
                (end_date === '' ? null : end_date) : rule.end_date
        };

        console.log('Final update data:', {
            ...updateData,
            condition_value_sample: typeof updateData.condition_value === 'string' ? 
                updateData.condition_value.substring(0, 100) : 'object/other'
        });

        const result = await pool.query(
            `UPDATE discount_rules 
             SET rule_name = COALESCE($1, rule_name),
                 rule_type = COALESCE($2, rule_type),
                 condition_value = COALESCE($3, condition_value),
                 discount_percent = COALESCE($4, discount_percent),
                 priority = COALESCE($5, priority),
                 is_active = COALESCE($6, is_active),
                 start_date = COALESCE($7, start_date),
                 end_date = $8, -- Прямая передача (может быть NULL)
                 last_applied = NULL
             WHERE rule_id = $9
             RETURNING *`,
            [
                rule_name || null,
                rule_type || null,
                conditionJson || null,
                discount_percent || null,
                priority || null,
                is_active !== undefined ? is_active : null,
                start_date || null,
                processedEndDate,
                ruleId
            ]
        );

        if (discount_percent !== undefined && 
            parseInt(discount_percent) !== rule.discount_percent) {
            await pool.query(
                `UPDATE discounts 
                 SET discount_percent = $1,
                     updated_at = NOW()
                 WHERE rule_id = $2 
                 AND (end_date IS NULL OR end_date > NOW())`,
                [parseInt(discount_percent), ruleId]
            );
        }

        await pool.query(
            `INSERT INTO audit_log 
             (user_id, audit_action, audit_table, table_id, new_data)
             VALUES ($1, 'UPDATE_DISCOUNT_RULE', 'discount_rules', $2, $3)`,
            [userId, ruleId, 
             JSON.stringify({ 
                 rule_name: updateData.rule_name,
                 old_discount: rule.discount_percent,
                 new_discount: updateData.discount_percent
             })]
        );

        res.json({
            message: 'Правило обновлено успешно',
            rule: result.rows[0]
        });

    } catch (error) {
        console.error('Ошибка обновления правила:', error);
        console.error('Stack trace:', error.stack);
        res.status(500).json({ 
            error: 'Ошибка обновления правила',
            details: error.message 
        });
    }
}

async removeRuleDiscounts(req, res) {
    try {
        const { ruleId } = req.params;
        const userId = req.user.userId;

        const discountsResult = await pool.query(
            `SELECT COUNT(*) as count FROM discounts 
             WHERE rule_id = $1 
             AND (end_date IS NULL OR end_date > NOW())`,
            [ruleId]
        );

        const count = parseInt(discountsResult.rows[0].count);

        if (count === 0) {
            return res.status(404).json({ 
                error: 'Нет активных скидок для этого правила' 
            });
        }

        await pool.query(
            `UPDATE discounts 
             SET end_date = NOW() - INTERVAL '1 day'
             WHERE rule_id = $1 
             AND (end_date IS NULL OR end_date > NOW())`,
            [ruleId]
        );

        await pool.query(
            `INSERT INTO audit_log 
             (user_id, audit_action, audit_table, table_id, new_data)
             VALUES ($1, 'REMOVE_RULE_DISCOUNTS', 'discounts', $2, $3)`,
            [userId, ruleId, 
             JSON.stringify({ removed_count: count })]
        );

        res.json({
            message: `Удалено ${count} скидок`,
            removed_count: count
        });

    } catch (error) {
        console.error('Ошибка удаления скидок правила:', error);
        res.status(500).json({ error: 'Ошибка удаления скидок правила' });
    }
}

}

module.exports = new DiscountController();