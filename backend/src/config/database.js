const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DB_URL,

    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,

    ssl:
        process.env.DB_SSL === 'true' || process.env.DB_SSL === '1'
            ? { rejectUnauthorized: false }
            : false,

    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000
});

pool.connect((err, client, release) => {
    if (err) {
        console.error('DB connect error:', err.message);
        console.error('Env:', {
            hasDB_URL: !!process.env.DB_URL,
            hasDB_USER: !!process.env.DB_USER,
            hasDB_PASSWORD: !!process.env.DB_PASSWORD,
            hasDB_HOST: !!process.env.DB_HOST,
            hasDB_PORT: !!process.env.DB_PORT,
            hasDB_NAME: !!process.env.DB_NAME,
        });
    } else {
        console.log('PostgreSQL connected');
        release();
    }
});

module.exports = pool;