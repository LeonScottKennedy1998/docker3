const { generateToken, verifyToken } = require('../utils/token');
const { authMiddleware, roleMiddleware } = require('../middleware/auth');
const pool = require('../config/database');
const jwt = require('jsonwebtoken');

process.env.JWT_SECRET = 'test_secret_key_for_jwt_tokens_12345';
process.env.JWT_EXPIRES_IN = '24h';

// Мокаем pool
jest.mock('../config/database', () => ({
    query: jest.fn()
}));

// Сохраняем оригинальные функции
const originalLog = console.log;
const originalError = console.error;

// Подменяем на моки
console.log = jest.fn();
console.error = jest.fn();

describe('Модуль аутентификации', () => {
    afterEach(() => {
        jest.clearAllMocks();
    });
    
    afterAll(() => {
        // Восстанавливаем оригиналы
        console.log = originalLog;
        console.error = originalError;
    });

    // ===== ТЕСТЫ TOKEN.JS =====
    describe('token.js', () => {
        test('Генерация токена с корректными данными', () => {
            const userId = 123;
            const email = 'test@mpt.ru';
            const role = 'Клиент';
            
            const token = generateToken(userId, email, role);
            
            expect(token).toBeDefined();
            expect(typeof token).toBe('string');
            expect(token.length).toBeGreaterThan(0);
            
            expect(console.log).toHaveBeenCalledWith(
                '🔐 Генерация токена для:',
                expect.objectContaining({ userId, email, role })
            );
        });
        
        test('Верификация валидного токена', () => {
            const testData = { userId: 123, email: 'test@mpt.ru', role: 'Клиент' };
            const token = generateToken(testData.userId, testData.email, testData.role);
            
            const decoded = verifyToken(token);
            
            expect(decoded.userId).toBe(testData.userId);
            expect(decoded.email).toBe(testData.email);
            expect(decoded.role).toBe(testData.role);
        });
        
        test('Ошибка при истёкшем токене', () => {
            const expiredToken = jwt.sign(
                { userId: 123, email: 'test@mpt.ru', role: 'Клиент' },
                'test_secret_key_for_jwt_tokens_12345',
                { expiresIn: '-1s' }
            );
            
            expect(() => verifyToken(expiredToken)).toThrow('jwt expired'); // ← изменил текст
        });
        
        test('Ошибка при повреждённом токене', () => {
            const invalidToken = 'invalid.token.string';
            
            expect(() => verifyToken(invalidToken)).toThrow('invalid token'); // ← изменил текст
        });
    });

    // ===== ТЕСТЫ AUTH MIDDLEWARE =====
    describe('authMiddleware', () => {
        let req, res, next;

        beforeEach(() => {
            req = {
                headers: {},
                path: '/api/test',
                method: 'GET'
            };
            res = {
                status: jest.fn().mockReturnThis(),
                json: jest.fn().mockReturnThis()
            };
            next = jest.fn();
        });

        test('должен возвращать 401, если токен отсутствует', async () => {
            await authMiddleware(req, res, next);

            expect(res.status).toHaveBeenCalledWith(401);
            expect(res.json).toHaveBeenCalledWith({ error: 'Требуется авторизация' });
            expect(next).not.toHaveBeenCalled();
        });

        test('должен возвращать 401 при невалидном токене', async () => {
            req.headers.authorization = 'Bearer invalid.token.here';

            await authMiddleware(req, res, next);

            expect(res.status).toHaveBeenCalledWith(401);
            expect(res.json).toHaveBeenCalledWith({
                error: 'Недействительный токен',
                code: 'INVALID_TOKEN'
            });
            expect(next).not.toHaveBeenCalled();
        });

        test('должен возвращать 401 при истёкшем токене', async () => {
            const expiredToken = jwt.sign(
                { userId: 123, email: 'test@mpt.ru', role: 'Клиент' },
                process.env.JWT_SECRET,
                { expiresIn: '-1s' }
            );
            req.headers.authorization = `Bearer ${expiredToken}`;

            await authMiddleware(req, res, next);

            expect(res.status).toHaveBeenCalledWith(401);
            expect(res.json).toHaveBeenCalledWith({
                error: 'Срок действия токена истек',
                code: 'TOKEN_EXPIRED'
            });
        });

        test('должен возвращать 401, если пользователь не найден в БД', async () => {
            const token = generateToken(999, 'notfound@mpt.ru', 'Клиент');
            req.headers.authorization = `Bearer ${token}`;

            pool.query.mockResolvedValueOnce({ rows: [] });

            await authMiddleware(req, res, next);

            expect(res.status).toHaveBeenCalledWith(401);
            expect(res.json).toHaveBeenCalledWith({
                error: 'Пользователь не найден',
                code: 'USER_NOT_FOUND'
            });
        });

        test('должен возвращать 403 и логировать попытку для заблокированного пользователя', async () => {
            const token = generateToken(123, 'blocked@mpt.ru', 'Клиент');
            req.headers.authorization = `Bearer ${token}`;

            pool.query
                .mockResolvedValueOnce({ rows: [{ is_active: false, user_id: 123 }] })
                .mockResolvedValueOnce({ rows: [] });

            await authMiddleware(req, res, next);

            expect(res.status).toHaveBeenCalledWith(403);
            expect(res.json).toHaveBeenCalledWith({
                error: 'Ваш аккаунт заблокирован. Обратитесь к администратору.',
                code: 'ACCOUNT_BLOCKED'
            });
            expect(pool.query).toHaveBeenCalledTimes(2);
        });

        test('должен пропускать запрос для активного пользователя', async () => {
            const token = generateToken(123, 'active@mpt.ru', 'Клиент');
            req.headers.authorization = `Bearer ${token}`;

            pool.query.mockResolvedValueOnce({ rows: [{ is_active: true, user_id: 123 }] });

            await authMiddleware(req, res, next);

            expect(next).toHaveBeenCalled();
            expect(req.user).toBeDefined();
            expect(req.user.userId).toBe(123);
        });

        test('должен пропускать запрос даже при ошибке БД (защита от сбоев)', async () => {
            const token = generateToken(123, 'active@mpt.ru', 'Клиент');
            req.headers.authorization = `Bearer ${token}`;

            pool.query.mockRejectedValueOnce(new Error('DB connection failed'));

            await authMiddleware(req, res, next);

            expect(next).toHaveBeenCalled();
            expect(req.user).toBeDefined();
            expect(console.error).toHaveBeenCalled();
        });
    });

    // ===== ТЕСТЫ ROLE MIDDLEWARE =====
    describe('roleMiddleware', () => {
        let req, res, next;

        beforeEach(() => {
            req = { user: null };
            res = {
                status: jest.fn().mockReturnThis(),
                json: jest.fn().mockReturnThis()
            };
            next = jest.fn();
        });

        test('должен возвращать 401, если пользователь не авторизован', () => {
            const middleware = roleMiddleware('Администратор');
            
            middleware(req, res, next);

            expect(res.status).toHaveBeenCalledWith(401);
            expect(res.json).toHaveBeenCalledWith({ error: 'Требуется авторизация' });
            expect(next).not.toHaveBeenCalled();
        });

        test('должен пропускать пользователя с подходящей ролью', () => {
            req.user = { role: 'Администратор' };
            const middleware = roleMiddleware('Администратор', 'Товаровед');

            middleware(req, res, next);

            expect(next).toHaveBeenCalled();
            expect(res.status).not.toHaveBeenCalled();
        });

        test('должен возвращать 403 для пользователя с неподходящей ролью', () => {
            req.user = { role: 'Клиент' };
            const middleware = roleMiddleware('Администратор', 'Товаровед');

            middleware(req, res, next);

            expect(res.status).toHaveBeenCalledWith(403);
            expect(res.json).toHaveBeenCalledWith({
                error: 'Доступ запрещен',
                userRole: 'Клиент',
                requiredRoles: ['Администратор', 'Товаровед']
            });
            expect(next).not.toHaveBeenCalled();
        });
    });
});