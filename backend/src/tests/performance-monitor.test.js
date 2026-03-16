const { PerformanceMonitor } = require('../middleware/performanceMonitor');
const pool = require('../config/database');

// Мокаем pool
jest.mock('../config/database', () => ({
    query: jest.fn()
}));

// Мокаем hrtime для предсказуемых значений
const mockHrtime = (seconds = 0, nanoseconds = 5000000) => {
    let callCount = 0;
    return jest.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) return [0, 0]; // первый вызов start
        return [seconds, nanoseconds]; // второй вызов end
    });
};

describe('PerformanceMonitor', () => {
    let monitor;
    const originalHrtime = process.hrtime;
    const originalMemoryUsage = process.memoryUsage;
    const originalConsoleError = console.error;

    beforeEach(() => {
        jest.clearAllMocks();
        monitor = new PerformanceMonitor();
        console.error = jest.fn(); // мокаем console.error
    });

    afterEach(() => {
        process.hrtime = originalHrtime;
        process.memoryUsage = originalMemoryUsage;
        console.error = originalConsoleError;
    });

    // ==================================================
    // startMeasurement и endMeasurement
    // ==================================================
    describe('startMeasurement and endMeasurement', () => {
        it('должен измерять время выполнения запроса и сохранять в БД', async () => {
            // Настраиваем hrtime
            process.hrtime = mockHrtime(0, 15000000); // 15 мс
            
            pool.query.mockResolvedValueOnce({ rows: [] });

            monitor.startMeasurement('req-123', '/api/test');
            const duration = await monitor.endMeasurement('req-123', 42);

            expect(duration).toBeCloseTo(15, 0); // примерно 15 мс
            
            expect(pool.query).toHaveBeenCalledWith(
                expect.stringContaining('INSERT INTO performance_metrics'),
                ['response_time', expect.any(Number), '/api/test', 42, expect.any(String)]
            );

            const insertArg = pool.query.mock.calls[0][1];
            expect(insertArg[1]).toBeCloseTo(15, 0); // проверка времени
            expect(JSON.parse(insertArg[4])).toHaveProperty('memory');
        });

        it('должен ничего не делать, если reqId не найден', async () => {
            monitor.startMeasurement('req-123', '/api/test');
            const duration = await monitor.endMeasurement('non-existent');

            expect(duration).toBeUndefined();
            expect(pool.query).not.toHaveBeenCalled();
        });

        it('должен обрабатывать ошибки при сохранении в БД', async () => {
            process.hrtime = mockHrtime(0, 10000000); // 10 мс
            
            pool.query.mockRejectedValueOnce(new Error('DB error'));

            monitor.startMeasurement('req-123', '/api/test');
            const duration = await monitor.endMeasurement('req-123', 42);

            expect(duration).toBeCloseTo(10, 0);
            expect(console.error).toHaveBeenCalledWith('Ошибка сохранения метрики:', expect.any(Error));
        });

        it('должен удалять reqId из Map после измерения', async () => {
            process.hrtime = mockHrtime();
            pool.query.mockResolvedValue({ rows: [] });

            monitor.startMeasurement('req-123', '/api/test');
            expect(monitor.startTimes.has('req-123')).toBe(true);

            await monitor.endMeasurement('req-123');
            expect(monitor.startTimes.has('req-123')).toBe(false);
        });
    });

    // ==================================================
    // saveMemoryUsage
    // ==================================================
    describe('saveMemoryUsage', () => {
        it('должен сохранять информацию об использовании памяти', async () => {
            process.memoryUsage = jest.fn().mockReturnValue({
                heapUsed: 50 * 1024 * 1024, // 50 MB
                rss: 100 * 1024 * 1024,      // 100 MB
                heapTotal: 80 * 1024 * 1024,  // 80 MB
                external: 10 * 1024 * 1024    // 10 MB
            });

            pool.query.mockResolvedValueOnce({ rows: [] });

            await monitor.saveMemoryUsage();

            expect(pool.query).toHaveBeenCalledWith(
                expect.stringContaining('INSERT INTO performance_metrics'),
                ['memory_usage', 50, expect.any(String)]
            );

            const additionalData = JSON.parse(pool.query.mock.calls[0][1][2]);
            expect(additionalData.rss).toBeCloseTo(100, 0);
            expect(additionalData.heapTotal).toBeCloseTo(80, 0);
            expect(additionalData.external).toBeCloseTo(10, 0);
        });

        it('должен обрабатывать ошибки при сохранении памяти', async () => {
            process.memoryUsage = jest.fn().mockReturnValue({ heapUsed: 50 });
            pool.query.mockRejectedValueOnce(new Error('DB error'));

            await monitor.saveMemoryUsage();

            expect(console.error).toHaveBeenCalledWith('Ошибка сохранения использования памяти:', expect.any(Error));
        });
    });

    // ==================================================
    // saveEmailSendTime
    // ==================================================
    describe('saveEmailSendTime', () => {
        it('должен сохранять время отправки email', async () => {
            pool.query.mockResolvedValueOnce({ rows: [] });

            await monitor.saveEmailSendTime('test@example.com', 123.45, true);

            expect(pool.query).toHaveBeenCalledWith(
                expect.stringContaining('INSERT INTO performance_metrics'),
                ['email_send_time', 123.45, expect.any(String)]
            );

            const additionalData = JSON.parse(pool.query.mock.calls[0][1][2]);
            expect(additionalData.email).toBe('test@example.com');
            expect(additionalData.success).toBe(true);
        });

        it('должен сохранять неуспешные отправки', async () => {
            pool.query.mockResolvedValueOnce({ rows: [] });

            await monitor.saveEmailSendTime('test@example.com', 0, false);

            const additionalData = JSON.parse(pool.query.mock.calls[0][1][2]);
            expect(additionalData.success).toBe(false);
        });
    });

    // ==================================================
    // saveRequestCount
    // ==================================================
    describe('saveRequestCount', () => {
        it('должен сохранять количество запросов', async () => {
            pool.query.mockResolvedValueOnce({ rows: [] });

            await monitor.saveRequestCount('/api/test');

            expect(pool.query).toHaveBeenCalledWith(
                expect.stringContaining('INSERT INTO performance_metrics'),
                ['request_count', 1, '/api/test']
            );
        });
    });

    // ==================================================
    // getStats
    // ==================================================
    describe('getStats', () => {
        it('должен возвращать статистику по метрикам', async () => {
            const mockStats = [
                { metric_type: 'response_time', total_count: 100, avg_value: '45.67', min_value: '1.23', max_value: '500.00', std_dev: '30.21', unique_endpoints: 5 },
                { metric_type: 'request_count', total_count: 500, avg_value: '1.00', min_value: '1.00', max_value: '1.00', std_dev: '0.00', unique_endpoints: 10 }
            ];

            pool.query.mockResolvedValueOnce({ rows: mockStats });

            const result = await monitor.getStats('2026-02-01', '2026-02-28');

            expect(pool.query).toHaveBeenCalledWith(
                expect.stringContaining('SELECT'),
                ['2026-02-01', '2026-02-28']
            );
            expect(result).toEqual(mockStats);
        });

        it('должен возвращать пустой массив при ошибке', async () => {
            pool.query.mockRejectedValueOnce(new Error('DB error'));

            const result = await monitor.getStats('2026-02-01', '2026-02-28');

            expect(result).toEqual([]);
            expect(console.error).toHaveBeenCalled();
        });
    });

    // ==================================================
    // getChartData
    // ==================================================
    describe('getChartData', () => {
        it('должен возвращать данные для графика', async () => {
            const mockChartData = [
                { hour: '2026-02-17 10:00:00', avg_value: '45.67', request_count: 12 },
                { hour: '2026-02-17 11:00:00', avg_value: '32.10', request_count: 15 }
            ];

            pool.query.mockResolvedValueOnce({ rows: mockChartData });

            const result = await monitor.getChartData('response_time', 24);

            expect(pool.query).toHaveBeenCalledWith(
                expect.stringContaining('INTERVAL \'24 hours\''),
                ['response_time']
            );
            expect(result).toEqual(mockChartData);
        });

        it('должен использовать интервал по умолчанию 24 часа', async () => {
            pool.query.mockResolvedValueOnce({ rows: [] });

            await monitor.getChartData('response_time');

            expect(pool.query).toHaveBeenCalledWith(
                expect.stringContaining('INTERVAL \'24 hours\''),
                ['response_time']
            );
        });
    });

    // ==================================================
    // getSlowRequests
    // ==================================================
    describe('getSlowRequests', () => {
        it('должен возвращать медленные запросы', async () => {
            const mockSlowRequests = [
                { endpoint: '/api/slow', response_time_ms: '500.23', created_at: '2026-02-17', exact_time: '2026-02-17T10:00:00Z' }
            ];

            pool.query.mockResolvedValueOnce({ rows: mockSlowRequests });

            const result = await monitor.getSlowRequests(5, 2);

            expect(pool.query).toHaveBeenCalledWith(
                expect.stringContaining('INTERVAL \'2 hours\''),
                [5]
            );
            expect(result).toEqual(mockSlowRequests);
        });

        it('должен использовать значения по умолчанию', async () => {
            pool.query.mockResolvedValueOnce({ rows: [] });

            await monitor.getSlowRequests();

            expect(pool.query).toHaveBeenCalledWith(
                expect.stringContaining('INTERVAL \'1 hours\''),
                [10]
            );
        });
    });

    // ==================================================
    // getEmailStats
    // ==================================================
    describe('getEmailStats', () => {
    it('должен возвращать статистику email', async () => {
        const mockStats = {
            total_emails: 10,
            successful: 9,
            failed: 1,
            avg_send_time_ms: '150.50',
            min_send_time_ms: '100.20',
            max_send_time_ms: '200.80'
        };

        pool.query.mockResolvedValueOnce({ rows: [mockStats] });

        const result = await monitor.getEmailStats(48);

        // ИСПРАВЛЕНО: проверяем ТОЛЬКО строку, без второго аргумента
        expect(pool.query).toHaveBeenCalledWith(
            expect.stringContaining('INTERVAL \'48 hours\'')
        );
        expect(result).toEqual(mockStats);
    });

    it('должен возвращать пустой объект при отсутствии данных', async () => {
        pool.query.mockResolvedValueOnce({ rows: [] });

        const result = await monitor.getEmailStats();

        expect(pool.query).toHaveBeenCalledWith(
            expect.stringContaining('INTERVAL \'24 hours\'')
        );
        expect(result).toEqual({});
    });
});
});