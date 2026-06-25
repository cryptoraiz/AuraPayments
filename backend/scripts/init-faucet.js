import pg from 'pg';
const { Client } = pg;
import 'dotenv/config';

const connectionString = process.env.POSTGRES_URL;

const client = new Client({ connectionString });

async function main() {
    await client.connect();

    console.log('💧 Checking Faucet Schema...');

    await client.query(`
    CREATE TABLE IF NOT EXISTS faucet_claims (
        wallet_address TEXT NOT NULL,
        ip_address TEXT,
        amount TEXT,
        tx_hash TEXT,
        claimed_at BIGINT
    );
  `);

    console.log('✅ Faucet Tables Ready!');
    await client.end();
}

main().catch(console.error);
