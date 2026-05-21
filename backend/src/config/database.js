const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DB_URL,
    ssl: {
        rejectUnauthorized: false
    },
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000
});

pool.connect((err, client, release) => {
    if (err) {
        console.error('DB connect error:', err.message);
        console.error('Env:', {
            hasDB_URL: !!process.env.DB_URL
        });
    } else {
        console.log('PostgreSQL connected');
        release();
    }
});

module.exports = pool;