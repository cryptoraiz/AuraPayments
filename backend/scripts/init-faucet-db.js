
import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env.local') });

const { Pool } = pg;

const connectionString = process.env.POSTGRES_URL;

if (!connectionString) {
    console.error('❌ POSTGRES_URL is not defined in .env.local');
    process.exit(1);
}

const pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false }
});

async function initFaucetDB() {
    console.log('🚰 Initializing Faucet Database...');

    try {
        // Create table for Faucet Claims
        // Tracks wallet address, IP (optional), and timestamp to enforce cooldown
        await pool.query(`
            CREATE TABLE IF NOT EXISTS faucet_claims (
                id SERIAL PRIMARY KEY,
                wallet_address VARCHAR(42) NOT NULL,
                ip_address VARCHAR(45),
                amount DECIMAL(20, 6) NOT NULL,
                tx_hash VARCHAR(66) NOT NULL,
                claimed_at BIGINT NOT NULL
            );
        `);

        // Index for faster lookups on wallet
        await pool.query(`
            CREATE INDEX IF NOT EXISTS idx_faucet_wallet ON faucet_claims(wallet_address);
        `);

        console.log('✅ Table "faucet_claims" created successfully.');
    } catch (err) {
        console.error('❌ Error initializing database:', err);
    } finally {
        await pool.end();
    }
}

initFaucetDB();
