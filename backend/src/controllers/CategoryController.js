const pool = require('../config/database');

class CategoryController {
    async getCategories(req, res) {
        try {
            const result = await pool.query(
                'SELECT * FROM categories ORDER BY category_name'
            );
            res.json(result.rows);
        } catch (error) {
            console.error('Ошибка получения категорий:', error);
            res.status(500).json({ error: 'Ошибка получения категорий' });
        }
    }

    async createCategory(req, res) {
        try {
            const { category_name, description } = req.body;

            if (!category_name) {
                return res.status(400).json({ error: 'Название категории обязательно' });
            }

            const result = await pool.query(
                `INSERT INTO categories (category_name, description)
                 VALUES ($1, $2)
                 RETURNING *`,
                [category_name, description || null]
            );

            await pool.query(
                `INSERT INTO audit_log 
                 (user_id, audit_action, audit_table, table_id, new_data)
                 VALUES ($1, 'CREATE_CATEGORY', 'categories', $2, $3)`,
                [req.user.userId, result.rows[0].category_id, 
                 JSON.stringify({ category_name, description })]
            );

            res.status(201).json({
                message: 'Категория успешно создана',
                category: result.rows[0]
            });

        } catch (error) {
            console.error('Ошибка создания категории:', error);
            res.status(500).json({ error: 'Ошибка создания категории' });
        }
    }

    async updateCategory(req, res) {
        try {
            const { id } = req.params;
            const { category_name, description } = req.body;

            if (!category_name) {
                return res.status(400).json({ error: 'Название категории обязательно' });
            }

            const result = await pool.query(
                `UPDATE categories 
                 SET category_name = $1, description = $2
                 WHERE category_id = $3
                 RETURNING *`,
                [category_name, description || null, id]
            );

            if (result.rows.length === 0) {
                return res.status(404).json({ error: 'Категория не найдена' });
            }

            await pool.query(
                `INSERT INTO audit_log 
                 (user_id, audit_action, audit_table, table_id, new_data)
                 VALUES ($1, 'UPDATE_CATEGORY', 'categories', $2, $3)`,
                [req.user.userId, id, JSON.stringify({ category_name, description })]
            );

            res.json({
                message: 'Категория успешно обновлена',
                category: result.rows[0]
            });

        } catch (error) {
            console.error('Ошибка обновления категории:', error);
            res.status(500).json({ error: 'Ошибка обновления категории' });
        }
    }

    async deleteCategory(req, res) {
        try {
            const { id } = req.params;

            // Проверяем, есть ли товары в этой категории
            const productsCheck = await pool.query(
                'SELECT COUNT(*) FROM products WHERE category_id = $1',
                [id]
            );

            if (parseInt(productsCheck.rows[0].count) > 0) {
                return res.status(400).json({ 
                    error: 'Нельзя удалить категорию, в которой есть товары' 
                });
            }

            const result = await pool.query(
                'DELETE FROM categories WHERE category_id = $1 RETURNING category_name',
                [id]
            );

            if (result.rows.length === 0) {
                return res.status(404).json({ error: 'Категория не найдена' });
            }

            await pool.query(
                `INSERT INTO audit_log 
                 (user_id, audit_action, audit_table, table_id, new_data)
                 VALUES ($1, 'DELETE_CATEGORY', 'categories', $2, $3)`,
                [req.user.userId, id, JSON.stringify({ 
                    category_name: result.rows[0].category_name 
                })]
            );

            res.json({
                message: 'Категория успешно удалена'
            });

        } catch (error) {
            console.error('Ошибка удаления категории:', error);
            res.status(500).json({ error: 'Ошибка удаления категории' });
        }
    }
}

module.exports = new CategoryController();