const pool = require('../config/database');

function mapRowToCartItem(row) {
    return {
        productId: row.product_id,
        name: row.product_name,
        price: Number(row.price),
        quantity: row.quantity,
    };
}

class CartController {
    async getCart(req, res) {
        try {
            const userId = req.user.userId;
            const result = await pool.query(
                `SELECT ci.product_id, ci.quantity, p.product_name, p.price
                 FROM user_cart_items ci
                 INNER JOIN products p ON p.product_id = ci.product_id AND p.is_active = true
                 WHERE ci.user_id = $1
                 ORDER BY ci.updated_at DESC`,
                [userId]
            );
            res.json({ items: result.rows.map(mapRowToCartItem) });
        } catch (error) {
            console.error('getCart:', error);
            res.status(500).json({ error: 'Не удалось загрузить корзину' });
        }
    }

    async putCart(req, res) {
        const userId = req.user.userId;
        const { items } = req.body;
        if (!Array.isArray(items)) {
            return res.status(400).json({ error: 'Ожидается массив items' });
        }

        const qtyMap = new Map();
        for (const raw of items) {
            const productId = Number(raw?.productId ?? raw?.product_id);
            const quantity = Number(raw?.quantity);
            if (!Number.isFinite(productId) || productId <= 0) continue;
            if (!Number.isFinite(quantity) || quantity < 1) continue;
            const q = Math.floor(quantity);
            qtyMap.set(productId, (qtyMap.get(productId) || 0) + q);
        }

        const normalized = [...qtyMap.entries()]
            .filter(([, q]) => q > 0)
            .map(([productId, quantity]) => ({ productId, quantity }));

        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            await client.query('DELETE FROM user_cart_items WHERE user_id = $1', [userId]);

            for (const { productId, quantity } of normalized) {
                const pr = await client.query(
                    'SELECT 1 FROM products WHERE product_id = $1 AND is_active = true',
                    [productId]
                );
                if (pr.rows.length === 0) continue;
                await client.query(
                    `INSERT INTO user_cart_items (user_id, product_id, quantity, updated_at)
                     VALUES ($1, $2, $3, NOW())`,
                    [userId, productId, quantity]
                );
            }

            await client.query('COMMIT');
        } catch (error) {
            await client.query('ROLLBACK').catch(() => {});
            console.error('putCart:', error);
            return res.status(500).json({ error: 'Не удалось сохранить корзину' });
        } finally {
            client.release();
        }

        try {
            const result = await pool.query(
                `SELECT ci.product_id, ci.quantity, p.product_name, p.price
                 FROM user_cart_items ci
                 INNER JOIN products p ON p.product_id = ci.product_id AND p.is_active = true
                 WHERE ci.user_id = $1
                 ORDER BY ci.updated_at DESC`,
                [userId]
            );
            res.json({ items: result.rows.map(mapRowToCartItem) });
        } catch (error) {
            console.error('putCart readback:', error);
            res.status(500).json({ error: 'Корзина сохранена, но не удалось вернуть состав' });
        }
    }
}

module.exports = new CartController();
