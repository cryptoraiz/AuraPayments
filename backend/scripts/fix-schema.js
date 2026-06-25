import pg from 'pg';
const { Client } = pg;
import 'dotenv/config';

const connectionString = process.env.POSTGRES_URL;

const client = new Client({
    connectionString,
});

async function main() {
    await client.connect();

    console.log('🗑️ Dropping old table...');
    await client.query(`DROP TABLE IF EXISTS invoices;`);

    console.log('✨ Creating new table with correct schema...');
    await client.query(`
    CREATE TABLE invoices (
      id TEXT PRIMARY KEY,  -- Changed from SERIAL to TEXT to support UUIDs
      "fromWallet" TEXT NOT NULL,
      "recipientWallet" TEXT NOT NULL,
      "recipientName" TEXT,
      amount NUMERIC NOT NULL,
      currency TEXT DEFAULT 'USDC',
      status TEXT DEFAULT 'pending',
      description TEXT,
      "createdAt" BIGINT,  -- Storing timestamp as number
      "updatedAt" BIGINT,
      "paidAt" BIGINT
    );
  `);

    console.log('✅ Table "invoices" fixed successfully!');
    await client.end();
}

main().catch(console.error);
