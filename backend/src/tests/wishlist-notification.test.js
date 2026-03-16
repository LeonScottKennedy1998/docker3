const WishlistNotificationService = require('../services/wishlistNotificationService');
const nodemailer = require('nodemailer');
const pool = require('../config/database');

// Мокаем зависимости
jest.mock('nodemailer');
jest.mock('../config/database', () => ({
    query: jest.fn()
}));

// Мокаем console методы
const originalLog = console.log;
const originalError = console.error;
console.log = jest.fn();
console.error = jest.fn();

describe('WishlistNotificationService', () => {
    let service;
    let mockTransporter;
    const originalEnv = process.env;

    beforeAll(() => {
        process.env = { ...originalEnv };
    });

    beforeEach(() => {
        jest.clearAllMocks();
        
        // Устанавливаем тестовые переменные окружения
        process.env.EMAIL_USER = 'test@mpt.ru';
        process.env.EMAIL_PASSWORD = 'testpass';
        process.env.EMAIL_FROM = 'noreply@mpt.ru';
        process.env.FRONTEND_URL = 'http://localhost:3000';

        // Создаём мок транспортера
        mockTransporter = {
            sendMail: jest.fn().mockResolvedValue({ messageId: '123' })
        };
        nodemailer.createTransport.mockReturnValue(mockTransporter);

        // Создаём экземпляр сервиса
        service = new WishlistNotificationService();
    });

    afterAll(() => {
        process.env = originalEnv;
        console.log = originalLog;
        console.error = originalError;
    });

    // ==================================================
    // isEmailConfigured
    // ==================================================
    describe('isEmailConfigured', () => {
        it('должен возвращать true, если EMAIL_USER и EMAIL_PASSWORD установлены', () => {
            const result = service.isEmailConfigured();
            expect(result).toBe(true);
        });

        it('должен возвращать false, если EMAIL_USER отсутствует', () => {
            delete process.env.EMAIL_USER;
            delete process.env.SMTP_USER;
            
            // Создаём новый экземпляр с обновлёнными переменными
            service = new WishlistNotificationService();
            
            const result = service.isEmailConfigured();
            expect(result).toBe(false);
        });

        it('должен возвращать false, если EMAIL_PASSWORD отсутствует', () => {
            delete process.env.EMAIL_PASSWORD;
            delete process.env.SMTP_PASS;
            
            // Создаём новый экземпляр с обновлёнными переменными
            service = new WishlistNotificationService();
            
            const result = service.isEmailConfigured();
            expect(result).toBe(false);
        });
    });

    // ==================================================
    // shouldSendNotification
    // ==================================================
    describe('shouldSendNotification', () => {
        it('должен возвращать true, если уведомление не отправлялось сегодня', async () => {
            pool.query.mockResolvedValueOnce({ rows: [] });

            const result = await service.shouldSendNotification(1, 2, 'stock_available');

            expect(pool.query).toHaveBeenCalledWith(
                expect.stringContaining('SELECT notification_id FROM wishlist_notifications'),
                [1, 2, 'stock_available', expect.any(String)]
            );
            expect(result).toBe(true);
        });

        it('должен возвращать false, если уведомление уже отправлялось сегодня', async () => {
            pool.query.mockResolvedValueOnce({ rows: [{ notification_id: 123 }] });

            const result = await service.shouldSendNotification(1, 2, 'stock_available');

            expect(result).toBe(false);
        });

        it('должен возвращать true при ошибке БД', async () => {
            pool.query.mockRejectedValueOnce(new Error('DB error'));

            const result = await service.shouldSendNotification(1, 2, 'stock_available');

            expect(result).toBe(true);
            expect(console.error).toHaveBeenCalled();
        });
    });

    // ==================================================
    // logNotification
    // ==================================================
    describe('logNotification', () => {
        it('должен сохранять запись об уведомлении в БД', async () => {
            pool.query.mockResolvedValueOnce({ rows: [] });

            await service.logNotification(1, 2, 'stock_available', '0', '10');

            expect(pool.query).toHaveBeenCalledWith(
                expect.stringContaining('INSERT INTO wishlist_notifications'),
                [1, 2, 'stock_available', '0', '10']
            );
        });

        it('должен обрабатывать ошибки при сохранении', async () => {
            pool.query.mockRejectedValueOnce(new Error('DB error'));

            await service.logNotification(1, 2, 'stock_available');

            expect(console.error).toHaveBeenCalled();
        });
    });

    // ==================================================
    // sendStockAvailableNotification
    // ==================================================
    describe('sendStockAvailableNotification', () => {
        const userEmail = 'user@example.com';
        const userName = 'Иван Иванов';
        const product = {
            product_name: 'Худи МПТ',
            category_name: 'Одежда',
            price: 2999,
            stock: 10,
            has_discount: true,
            discount_percent: 15,
            final_price: 2549
        };

        beforeEach(() => {
            // Сбрасываем моки перед каждым тестом в этом describe
            jest.clearAllMocks();
        });

        it('должен отправлять email о наличии товара', async () => {
            // Диагностика
            console.log('=== Диагностика sendStockAvailableNotification ===');
            console.log('EMAIL_USER:', process.env.EMAIL_USER);
            console.log('EMAIL_PASSWORD:', process.env.EMAIL_PASSWORD);
            console.log('EMAIL_FROM:', process.env.EMAIL_FROM);
            console.log('isEmailConfigured:', service.isEmailConfigured());
            
            const result = await service.sendStockAvailableNotification(
                userEmail,
                product,
                userName
            );

            console.log('Результат:', result);
            console.log('sendMail вызван:', mockTransporter.sendMail.mock.calls.length > 0);
            
            expect(console.error).not.toHaveBeenCalled();
            expect(result).toBe(true);
            expect(mockTransporter.sendMail).toHaveBeenCalledTimes(1);
            
            const mailOptions = mockTransporter.sendMail.mock.calls[0][0];
            expect(mailOptions.to).toBe(userEmail);
            expect(mailOptions.subject).toContain('снова в наличии');
            expect(mailOptions.subject).toContain(product.product_name);
            expect(mailOptions.html).toContain(userName);
            expect(mailOptions.html).toContain(product.product_name);
            expect(mailOptions.html).toContain(product.price.toLocaleString());
            expect(mailOptions.text).toBeDefined();
        });

        it('должен возвращать false, если email не настроен', async () => {
            // Удаляем переменные окружения
            delete process.env.EMAIL_USER;
            delete process.env.SMTP_USER;
            
            // Создаём новый экземпляр с обновлёнными переменными
            service = new WishlistNotificationService();
            
            const result = await service.sendStockAvailableNotification(
                userEmail,
                product,
                userName
            );

            expect(result).toBe(false);
            expect(mockTransporter.sendMail).not.toHaveBeenCalled();
        });

        it('должен возвращать false при ошибке отправки', async () => {
            mockTransporter.sendMail.mockRejectedValueOnce(new Error('SMTP error'));

            const result = await service.sendStockAvailableNotification(
                userEmail,
                product,
                userName
            );

            expect(result).toBe(false);
            expect(console.error).toHaveBeenCalled();
        });

        it('должен корректно формировать HTML для товара без скидки', async () => {
            const productWithoutDiscount = {
                ...product,
                has_discount: false
            };

            const result = await service.sendStockAvailableNotification(
                userEmail,
                productWithoutDiscount,
                userName
            );

            expect(result).toBe(true);
            expect(mockTransporter.sendMail).toHaveBeenCalled();
            
            const mailOptions = mockTransporter.sendMail.mock.calls[0][0];
            // Проверяем, что HTML не содержит блок со скидкой
            expect(mailOptions.html).not.toContain('Скидка');
            expect(mailOptions.html).not.toContain('discount_percent');
        });
    });

    // ==================================================
    // sendDiscountNotification
    // ==================================================
    describe('sendDiscountNotification', () => {
        const userEmail = 'user@example.com';
        const userName = 'Иван Иванов';
        const product = {
            product_name: 'Худи МПТ',
            category_name: 'Одежда',
            stock: 10
        };
        const oldPrice = 2999;
        const newPrice = 2549;
        const discountPercent = 15;

        beforeEach(() => {
            jest.clearAllMocks();
        });

        it('должен отправлять email о скидке', async () => {
            const result = await service.sendDiscountNotification(
                userEmail,
                product,
                userName,
                oldPrice,
                newPrice,
                discountPercent
            );

            expect(result).toBe(true);
            expect(mockTransporter.sendMail).toHaveBeenCalledTimes(1);
            
            const mailOptions = mockTransporter.sendMail.mock.calls[0][0];
            expect(mailOptions.to).toBe(userEmail);
            expect(mailOptions.subject).toContain(`Скидка ${discountPercent}%`);
            expect(mailOptions.subject).toContain(product.product_name);
            expect(mailOptions.html).toContain(userName);
            expect(mailOptions.html).toContain(oldPrice.toLocaleString());
            expect(mailOptions.html).toContain(newPrice.toLocaleString());
            expect(mailOptions.html).toContain(`-${discountPercent}%`);
            expect(mailOptions.text).toBeDefined();
        });

        it('должен возвращать false, если email не настроен', async () => {
            delete process.env.EMAIL_USER;
            delete process.env.SMTP_USER;
            
            service = new WishlistNotificationService();
            
            const result = await service.sendDiscountNotification(
                userEmail,
                product,
                userName,
                oldPrice,
                newPrice,
                discountPercent
            );

            expect(result).toBe(false);
            expect(mockTransporter.sendMail).not.toHaveBeenCalled();
        });

        it('должен возвращать false при ошибке отправки', async () => {
            mockTransporter.sendMail.mockRejectedValueOnce(new Error('SMTP error'));

            const result = await service.sendDiscountNotification(
                userEmail,
                product,
                userName,
                oldPrice,
                newPrice,
                discountPercent
            );

            expect(result).toBe(false);
            expect(console.error).toHaveBeenCalled();
        });
    });
});