import pg from 'pg';
const { Client } = pg;

// Load env variables
import 'dotenv/config';
const connectionString = process.env.POSTGRES_URL;

const client = new Client({
  connectionString,
  ssl: { rejectUnauthorized: false }
});

async function initDB() {
  try {
    await client.connect();
    console.log('Connected to Neon DB...');

    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS invoices (
        id VARCHAR(255) PRIMARY KEY,
        "fromWallet" VARCHAR(255),
        "recipientWallet" VARCHAR(255),
        "recipientName" VARCHAR(255),
        amount NUMERIC,
        currency VARCHAR(10),
        description TEXT,
        status VARCHAR(50),
        "createdAt" BIGINT,
        "updatedAt" BIGINT,
        "txHash" VARCHAR(255),
        "payer" VARCHAR(255),
        "paidAt" BIGINT
      );
    `;

    await client.query(createTableQuery);
    console.log('✅ Table "invoices" created successfully!');

    // Check if table exists
    const res = await client.query("SELECT * FROM invoices LIMIT 1");
    console.log('Test Select:', res.rowCount, 'rows');

  } catch (err) {
    console.error('❌ Error initializing DB:', err);
  } finally {
    await client.end();
  }
}

initDB();
