import pg from 'pg';
const { Client } = pg;
import 'dotenv/config';

const connectionString = process.env.POSTGRES_URL;

const client = new Client({ connectionString });

async function main() {
    await client.connect();

    console.log('🗑️  Resetting Faucet Stats...');

    await client.query(`DELETE FROM faucet_claims;`);

    console.log('✅ Faucet Stats Cleared (Table is empty)!');
    await client.end();
}

main().catch(console.error);
