require('dotenv').config();
const express = require('express');
const cors = require('cors');
const pool = require('./src/config/database');
const sqlInjectionCheck = require('./src/middleware/sqlInjectionCheck');
const { setupCronJobs } = require('./src/cron/notificationCron');
const { performanceMiddleware, PerformanceMonitor } = require('./src/middleware/performanceMonitor');

const authRoutes = require('./src/routes/AuthRoutes');
const productRoutes = require('./src/routes/ProductRoutes');
const orderRoutes = require('./src/routes/OrderRoutes');
const analyticsRoutes = require('./src/routes/AnalyticsRoutes');
const userRoutes = require('./src/routes/UserRoutes');
const auditRoutes = require('./src/routes/AuditRoutes');
const backupRoutes = require('./src/routes/BackupRoutes');
const wishlistRoutes = require('./src/routes/WishlistRoutes');
const discountRoutes = require('./src/routes/DiscountRoutes');
const purchaseRoutes = require('./src/routes/PurchaseRoutes');
const performanceRoutes = require('./src/routes/PerformanceRoutes');
const categoryRoutes = require('./src/routes/CategoryRoutes');
const reviewRoutes = require('./src/routes/ReviewRoutes');
const cartRoutes = require('./src/routes/CartRoutes');

const app = express();
const port = process.env.PORT || 5001;
const HOST = process.env.BIND_HOST || '0.0.0.0';

app.set('trust proxy', 1);

const corsOptions = {
    origin: true,
    credentials: true,
    optionsSuccessStatus: 200,
};

app.use(cors(corsOptions));


app.use(express.json());
app.use(sqlInjectionCheck);
app.use(performanceMiddleware);


async function checkDatabase() {
    try {
        const result = await pool.query('SELECT NOW()');
        console.log('DB OK', result.rows[0].now);

        const tables = await pool.query(`
            SELECT table_name
            FROM information_schema.tables
            WHERE table_schema = 'public'
            ORDER BY table_name
        `);

        console.log('Tables:', tables.rows.map((t) => t.table_name).join(', '));
    } catch (error) {
        console.error('DB error:', error.message);
    }
}


app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/users', userRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/backup', backupRoutes);
app.use('/api/wishlist', wishlistRoutes);
app.use('/api/discounts', discountRoutes);
app.use('/api/procurement', purchaseRoutes);
app.use('/api/performance', performanceRoutes);
app.use('/api/products/categories', categoryRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/cart', cartRoutes);


const startPerformanceMonitoring = () => {
    const monitor = new PerformanceMonitor();

    setInterval(() => {
        monitor.saveMemoryUsage().catch(console.error);
    }, 5 * 60 * 1000);

    console.log('Performance monitor interval started');
};

app.listen(port, HOST, () => {
    console.log(`Server ${HOST}:${port}`);

    checkDatabase()
        .then(() => {
            setupCronJobs();
            startPerformanceMonitoring();
        })
        .catch((error) => {
            console.error('Startup error:', error);
        });
});