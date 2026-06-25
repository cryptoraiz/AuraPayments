
import pg from 'pg';
import '../env.js'; // Helper to load .env variables if needed

const { Pool } = pg;

const connectionString = process.env.POSTGRES_URL;

if (!connectionString) {
    console.error('❌ POSTGRES_URL is not defined in environment variables.');
    process.exit(1);
}

const pool = new Pool({
    connectionString,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function initDB() {
    console.log('🔄 Initializing Database...');
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // Create Invoices Table
        const createTableQuery = `
            CREATE TABLE IF NOT EXISTS invoices (
                id VARCHAR(255) PRIMARY KEY,
                "fromWallet" VARCHAR(42) NOT NULL,
                "recipientWallet" VARCHAR(42) NOT NULL,
                "recipientName" VARCHAR(255),
                amount VARCHAR(255) NOT NULL,
                currency VARCHAR(10) NOT NULL,
                description TEXT,
                status VARCHAR(50) DEFAULT 'pending',
                "createdAt" BIGINT NOT NULL,
                "updatedAt" BIGINT,
                "txHash" VARCHAR(255),
                payer VARCHAR(42),
                "paidAt" BIGINT
            );
        `;

        await client.query(createTableQuery);
        console.log('✅ Table "invoices" ensure existing.');

        await client.query('COMMIT');
        console.log('🚀 Database initialization complete.');
    } catch (e) {
        await client.query('ROLLBACK');
        console.error('❌ Database initialization failed:', e);
    } finally {
        client.release();
        await pool.end();
    }
}

initDB();
