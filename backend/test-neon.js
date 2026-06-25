import pg from 'pg';
import 'dotenv/config';

const { Client } = pg;
const client = new Client({
  connectionString: process.env.POSTGRES_URL
});

async function main() {
  try {
    await client.connect();
    const res = await client.query('SELECT * FROM faucet_claims LIMIT 5');
    console.log('Neon faucet_claims:', res.rows);
    const countRes = await client.query('SELECT COUNT(*) as claims, COUNT(DISTINCT wallet_address) as unique_wallets, COALESCE(SUM(CAST(amount AS DECIMAL)), 0) as total_distributed FROM faucet_claims');
    console.log('Stats:', countRes.rows[0]);
  } catch(e) { console.error('Error:', e.message); }
  process.exit(0);
}
main();
