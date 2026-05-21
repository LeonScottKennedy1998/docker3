const pool = require('../config/database');

function normalizeExtraInfo(raw) {
    if (raw === undefined || raw === null) return {};
    if (typeof raw === 'object' && !Array.isArray(raw)) {
        const out = {};
        for (const [k, v] of Object.entries(raw)) {
            const key = String(k || '').trim();
            if (!key) continue;
            out[key] = String(v ?? '').trim();
        }
        return out;
    }
    return {};
}

function normalizeImageList(body) {
    const urls = [];
    if (Array.isArray(body.images)) {
        for (const u of body.images) {
            const s = typeof u === 'string' ? u.trim() : '';
            if (s) urls.push(s);
        }
    }
    if (urls.length === 0 && body.image_url) {
        const s = String(body.image_url).trim();
        if (s) urls.push(s);
    }
    return urls;
}

async function replaceProductImages(productId, urls) {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        await client.query('DELETE FROM product_images WHERE product_id = $1', [productId]);
        for (let i = 0; i < urls.length; i++) {
            await client.query(
                'INSERT INTO product_images (product_id, image_url, sort_order) VALUES ($1, $2, $3)',
                [productId, urls[i], i]
            );
        }
        await client.query('COMMIT');
    } catch (e) {
        await client.query('ROLLBACK');
        throw e;
    } finally {
        client.release();
    }
}

async function loadImagesByProductIds(productIds) {
    if (!productIds.length) return new Map();
    const r = await pool.query(
        `SELECT product_id, image_url FROM product_images
         WHERE product_id = ANY($1::int[])
         ORDER BY product_id, sort_order, image_id`,
        [productIds]
    );
    const map = new Map();
    for (const row of r.rows) {
        if (!map.has(row.product_id)) map.set(row.product_id, []);
        map.get(row.product_id).push(row.image_url);
    }
    return map;
}

function enrichProductRow(p, imageMap) {
    let images = imageMap.get(p.id) || [];
    if (!images.length && p.image_url) images = [p.image_url];
    let extra_info = {};
    if (p.extra_info != null && typeof p.extra_info === 'object' && !Array.isArray(p.extra_info)) {
        extra_info = p.extra_info;
    }
    const { extra_info: _e, ...rest } = p;
    return { ...rest, images, extra_info };
}

class ProductController {
    async getProducts(req, res) {
    try {
        const result = await pool.query(`
            SELECT 
                p.product_id as id,
                p.product_name as name,
                p.description,
                p.price,
                p.stock,
                p.image_url,
                p.is_active,
                p.created_at,
                c.category_name as category,
                COALESCE(
                    (SELECT discount_percent 
                     FROM discounts d 
                     WHERE d.product_id = p.product_id 
                     AND (d.end_date IS NULL OR d.end_date > NOW())
                     ORDER BY d.created_at DESC 
                     LIMIT 1), 0
                ) as discount_percent,
                COALESCE(
                    (SELECT end_date 
                     FROM discounts d 
                     WHERE d.product_id = p.product_id 
                     AND (d.end_date IS NULL OR d.end_date > NOW())
                     ORDER BY d.created_at DESC 
                     LIMIT 1), NULL
                ) as discount_end_date,
                COALESCE(
                    (SELECT AVG(rating) FROM reviews WHERE product_id = p.product_id), 0
                ) as avg_rating,
                COALESCE(
                    (SELECT COUNT(*) FROM reviews WHERE product_id = p.product_id), 0
                ) as reviews_count,
                p.extra_info
            FROM products p
            LEFT JOIN categories c ON p.category_id = c.category_id
            WHERE p.is_active = true
            ORDER BY p.created_at DESC
        `);

        const ids = result.rows.map((r) => r.id);
        const imageMap = await loadImagesByProductIds(ids);

        const productsWithDiscount = result.rows.map((product) => {
            const enriched = enrichProductRow(product, imageMap);
            const price = parseFloat(enriched.price) || 0;
            const discountPercent = parseFloat(product.discount_percent) || 0;
            
            let finalPrice = price;
            let hasDiscount = false;
            
            if (discountPercent > 0 && discountPercent <= 100) {
                finalPrice = price * (1 - discountPercent / 100);
                finalPrice = Math.round(finalPrice * 100) / 100;
                hasDiscount = true;
            }

            return {
                ...enriched,
                final_price: finalPrice,
                has_discount: hasDiscount,
                discount_percent: discountPercent,
                discount_end_date: enriched.discount_end_date,
                original_price: price,
                avg_rating: parseFloat(enriched.avg_rating) || 0,
                reviews_count: parseInt(enriched.reviews_count) || 0
            };
        });
        
        res.json(productsWithDiscount);
    } catch (error) {
        console.error('Ошибка получения товаров:', error);
        res.status(500).json({ error: 'Ошибка получения товаров' });
    }
}

async getProductById(req, res) {
    try {
        const { id } = req.params;
        
        const result = await pool.query(`
            SELECT 
                p.product_id as id,
                p.product_name as name,
                p.description,
                p.price,
                p.stock,
                p.image_url,
                p.is_active,
                p.created_at,
                c.category_name as category,
                p.extra_info,
                COALESCE(
                    (SELECT discount_percent 
                     FROM discounts d 
                     WHERE d.product_id = p.product_id 
                     AND (d.end_date IS NULL OR d.end_date > NOW())
                     ORDER BY d.created_at DESC 
                     LIMIT 1), 0
                ) as discount_percent,
                COALESCE(
                    (SELECT AVG(rating) FROM reviews WHERE product_id = p.product_id), 0
                ) as avg_rating,
                COALESCE(
                    (SELECT COUNT(*) FROM reviews WHERE product_id = p.product_id), 0
                ) as reviews_count
            FROM products p
            LEFT JOIN categories c ON p.category_id = c.category_id
            WHERE p.product_id = $1 AND p.is_active = true
        `, [id]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Товар не найден' });
        }
        
        const imageMap = await loadImagesByProductIds([parseInt(id, 10)]);
        const product = enrichProductRow(result.rows[0], imageMap);
        const price = parseFloat(product.price) || 0;
        const discountPercent = parseFloat(product.discount_percent) || 0;
        
        let finalPrice = price;
        let hasDiscount = false;
        
        if (discountPercent > 0 && discountPercent <= 100) {
            finalPrice = price * (1 - discountPercent / 100);
            finalPrice = Math.round(finalPrice * 100) / 100;
            hasDiscount = true;
        }
        
        const productWithDiscount = {
            ...product,
            final_price: finalPrice,
            has_discount: hasDiscount,
            discount_percent: discountPercent,
            original_price: price,
            avg_rating: parseFloat(product.avg_rating) || 0,
            reviews_count: parseInt(product.reviews_count, 10) || 0,
        };

        res.json(productWithDiscount);
    } catch (error) {
        console.error('Ошибка получения товара:', error);
        res.status(500).json({ error: 'Ошибка получения товара' });
    }
}

    async getCategories(req, res) {
        try {
            const result = await pool.query('SELECT * FROM categories ORDER BY category_name');
            res.json(result.rows);
        } catch (error) {
            console.error('Ошибка получения категорий:', error);
            res.status(500).json({ error: 'Ошибка получения категорий' });
        }
    }


    async createProduct(req, res) {
    try {
        const { name, description, price, category_id, stock, image_url, extra_info } = req.body;

        if (!name || !price || !category_id) {
            return res.status(400).json({ 
                error: 'Название, цена и категория обязательны' 
            });
        }
        
        if (price < 0) {
            return res.status(400).json({ error: 'Цена не может быть отрицательной' });
        }
        
        const initialStock = parseInt(stock) || 0;
        if (initialStock < 0) {
            return res.status(400).json({ error: 'Количество не может быть отрицательным' });
        }

        const urls = normalizeImageList(req.body);
        const primaryImage = urls[0] || image_url || null;
        const extraJson = normalizeExtraInfo(extra_info);
        
        const result = await pool.query(
            `INSERT INTO products 
             (product_name, description, price, category_id, stock, image_url, is_active, extra_info)
             VALUES ($1, $2, $3, $4, $5, $6, true, $7::jsonb)
             RETURNING product_id as id, product_name as name, description, price, 
                       stock, image_url, category_id, created_at`,
            [name, description, price, category_id, initialStock, primaryImage, JSON.stringify(extraJson)]
        );

        const newId = result.rows[0].id;
        if (urls.length > 0) {
            await replaceProductImages(newId, urls);
        }
        
        await pool.query(
            `INSERT INTO audit_log 
             (user_id, audit_action, audit_table, table_id, new_data)
             VALUES ($1, 'CREATE_PRODUCT', 'products', $2, $3)`,
            [req.user.userId, newId, 
             JSON.stringify({ 
                 name, 
                 price, 
                 category_id, 
                 initial_stock: initialStock,
                 images_count: urls.length
             })]
        );

        const outProduct = {
            ...result.rows[0],
            images: urls.length ? urls : (primaryImage ? [primaryImage] : []),
            extra_info: extraJson
        };
        
        res.status(201).json({
            message: `Товар успешно создан (остаток: ${initialStock})`,
            product: outProduct
        });
        
    } catch (error) {
        console.error('Ошибка создания товара:', error);
        res.status(500).json({ error: 'Ошибка создания товара' });
    }
}


    async updateProduct(req, res) {
    try {
        const { id } = req.params;
        const { name, description, price, category_id, stock, image_url, is_active, extra_info } = req.body;

        const currentProduct = await pool.query(
            'SELECT stock, product_name, extra_info FROM products WHERE product_id = $1',
            [id]
        );

        if (currentProduct.rows.length === 0) {
            return res.status(404).json({ error: 'Товар не найден' });
        }

        const currentStock = currentProduct.rows[0].stock;
        const productName = currentProduct.rows[0].product_name;
        const prevExtra = currentProduct.rows[0].extra_info;
        const prevExtraObj =
            prevExtra && typeof prevExtra === 'object' && !Array.isArray(prevExtra)
                ? prevExtra
                : {};

        let newStock = currentStock;
        if (stock !== undefined) {
            const parsedStock = parseInt(stock);
            if (isNaN(parsedStock) || parsedStock < 0) {
                return res.status(400).json({ error: 'Количество должно быть неотрицательным числом' });
            }
            newStock = parsedStock;
        }

        const extraPayload = extra_info !== undefined ? normalizeExtraInfo(extra_info) : prevExtraObj;

        const imagesProvided = Array.isArray(req.body.images);
        const urlsFromBody = imagesProvided ? normalizeImageList(req.body) : null;
        const imageParamForUpdate = imagesProvided ? (urlsFromBody[0] ?? null) : image_url;

        const result = await pool.query(
            `UPDATE products 
             SET product_name = COALESCE($1, product_name),
                 description = COALESCE($2, description),
                 price = COALESCE($3, price),
                 category_id = COALESCE($4, category_id),
                 stock = $5,
                 image_url = CASE WHEN $10 THEN $6::varchar ELSE COALESCE($6, image_url) END,
                 is_active = COALESCE($7, is_active),
                 extra_info = $8::jsonb,
                 updated_at = CURRENT_TIMESTAMP
             WHERE product_id = $9
             RETURNING product_id as id, product_name as name, description, price, 
                       stock, image_url, category_id, is_active, created_at, updated_at`,
            [
                name,
                description,
                price,
                category_id,
                newStock,
                imageParamForUpdate,
                is_active,
                JSON.stringify(extraPayload),
                id,
                imagesProvided
            ]
        );

        if (imagesProvided) {
            await replaceProductImages(parseInt(id, 10), urlsFromBody);
        }

        let galleryUrls = [];
        if (imagesProvided) {
            galleryUrls = urlsFromBody || [];
        } else {
            const im = await loadImagesByProductIds([parseInt(id, 10)]);
            galleryUrls = im.get(parseInt(id, 10)) || [];
            if (!galleryUrls.length && result.rows[0].image_url) {
                galleryUrls = [result.rows[0].image_url];
            }
        }

        await pool.query(
            `INSERT INTO audit_log 
             (user_id, audit_action, audit_table, table_id, old_data, new_data)
             VALUES ($1, 'UPDATE_PRODUCT', 'products', $2, $3, $4)`,
            [
                req.user.userId,
                id,
                JSON.stringify({
                    old_stock: currentStock,
                    product_name: productName
                }),
                JSON.stringify({
                    new_stock: newStock,
                    stock_changed: newStock !== currentStock,
                    fields_updated: { name, price, category_id, images: imagesProvided }
                })
            ]
        );

        const productOut = {
            ...result.rows[0],
            images: galleryUrls,
            extra_info: extraPayload
        };

        res.json({
            message: 'Товар успешно обновлен',
            product: productOut,
            stock_changed: newStock !== currentStock
        });
    } catch (error) {
        console.error('Ошибка обновления товара:', error);
        res.status(500).json({ error: 'Ошибка обновления товара' });
    }
}

    async deactivateProduct(req, res) {
        try {
            const { id } = req.params;
            
            const result = await pool.query(
                `UPDATE products 
                 SET is_active = false
                 WHERE product_id = $1 AND is_active = true
                 RETURNING product_id as id, product_name as name`,
                [id]
            );
            
            if (result.rows.length === 0) {
                return res.status(404).json({ error: 'Товар не найден или уже снят с продажи' });
            }
            
            await pool.query(
                `INSERT INTO audit_log 
                 (user_id, audit_action, audit_table, table_id, new_data)
                 VALUES ($1, 'DEACTIVATE_PRODUCT', 'products', $2, $3)`,
                [req.user.userId, id, JSON.stringify({ action: 'deactivated' })]
            );
            
            res.json({
                message: 'Товар успешно снят с продажи',
                product: result.rows[0]
            });
            
        } catch (error) {
            console.error('Ошибка снятия товара с продажи:', error);
            res.status(500).json({ error: 'Ошибка снятия товара с продажи' });
        }
    }

    async activateProduct(req, res) {
        try {
            const { id } = req.params;
            
            const result = await pool.query(
                `UPDATE products 
                 SET is_active = true
                 WHERE product_id = $1 AND is_active = false
                 RETURNING product_id as id, product_name as name`,
                [id]
            );
            
            if (result.rows.length === 0) {
                return res.status(404).json({ error: 'Товар не найден или уже активен' });
            }
            
            await pool.query(
                `INSERT INTO audit_log 
                 (user_id, audit_action, audit_table, table_id, new_data)
                 VALUES ($1, 'ACTIVATE_PRODUCT', 'products', $2, $3)`,
                [req.user.userId, id, JSON.stringify({ action: 'activated' })]
            );
            
            res.json({
                message: 'Товар успешно активирован',
                product: result.rows[0]
            });
            
        } catch (error) {
            console.error('Ошибка активации товара:', error);
            res.status(500).json({ error: 'Ошибка активации товара' });
        }
    }

    async getAllProducts(req, res) {
        try {
            const result = await pool.query(`
                SELECT 
                    p.product_id as id,
                    p.product_name as name,
                    p.description,
                    p.price,
                    p.stock,
                    p.image_url,
                    p.is_active,
                    p.created_at,
                    p.extra_info,
                    p.category_id,
                    c.category_name as category
                FROM products p
                LEFT JOIN categories c ON p.category_id = c.category_id
                ORDER BY p.is_active DESC, p.created_at DESC
            `);

            const ids = result.rows.map((r) => r.id);
            const imageMap = await loadImagesByProductIds(ids);
            const rows = result.rows.map((row) => enrichProductRow(row, imageMap));

            res.json(rows);
        } catch (error) {
            console.error('Ошибка получения всех товаров:', error);
            res.status(500).json({ error: 'Ошибка получения товаров' });
        }
    }


async getProductsBatch(req, res) {
    try {
        const { productIds } = req.body;
        
        if (!productIds || !Array.isArray(productIds) || productIds.length === 0) {
            return res.status(400).json({ error: 'Список ID товаров обязателен' });
        }
        
        if (productIds.length > 100) {
            return res.status(400).json({ error: 'Максимум 100 товаров за раз' });
        }
        
        const placeholders = productIds.map((_, index) => `$${index + 1}`).join(',');
        
        const result = await pool.query(`
            SELECT 
                p.product_id as id,
                p.product_name as name,
                p.description,
                p.price,
                p.stock,
                p.image_url,
                p.is_active,
                p.created_at,
                p.extra_info,
                c.category_name as category,
                COALESCE(
                    (SELECT discount_percent 
                     FROM discounts d 
                     WHERE d.product_id = p.product_id 
                     AND (d.end_date IS NULL OR d.end_date > NOW())
                     ORDER BY d.created_at DESC 
                     LIMIT 1), 0
                ) as discount_percent
            FROM products p
            LEFT JOIN categories c ON p.category_id = c.category_id
            WHERE p.product_id IN (${placeholders})
            AND p.is_active = true
        `, productIds);

        const ids = result.rows.map((r) => r.id);
        const imageMap = await loadImagesByProductIds(ids);

        const productsWithDiscount = result.rows.map((product) => {
            const enriched = enrichProductRow(product, imageMap);
            const price = parseFloat(enriched.price) || 0;
            const discountPercent = parseFloat(product.discount_percent) || 0;
            
            let finalPrice = price;
            let hasDiscount = false;
            
            if (discountPercent > 0 && discountPercent <= 100) {
                finalPrice = price * (1 - discountPercent / 100);
                finalPrice = Math.round(finalPrice * 100) / 100;
                hasDiscount = true;
            }

            return {
                ...enriched,
                final_price: finalPrice,
                has_discount: hasDiscount,
                discount_percent: discountPercent,
                original_price: price
            };
        });
        
        res.json(productsWithDiscount);
        
    } catch (error) {
        console.error('Ошибка получения товаров batch:', error);
        res.status(500).json({ error: 'Ошибка получения товаров' });
    }
}
}

module.exports = new ProductController();