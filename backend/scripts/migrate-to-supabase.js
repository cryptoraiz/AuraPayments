import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const { Pool } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env variables to get NEON url
dotenv.config({ path: path.join(__dirname, '../.env.local') });

// The user must provide these variables when running the script
const NEON_URL = process.env.POSTGRES_URL; // From your .env.local
const SUPABASE_URL = process.env.SUPABASE_URL; // Passed via terminal

if (!NEON_URL || !SUPABASE_URL) {
    console.error('❌ ERRO: Necessário fornecer a URL do Neon no .env.local e a URL do Supabase via variável de ambiente SUPABASE_URL');
    console.error('Exemplo: SUPABASE_URL="postgresql://..." node scripts/migrate-to-supabase.js');
    process.exit(1);
}

// Neon connection
const neonPool = new Pool({
    connectionString: NEON_URL,
    ssl: { rejectUnauthorized: false }
});

// Supabase connection
const supabasePool = new Pool({
    connectionString: SUPABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function migrate() {
    console.log('🚀 Iniciando Migração: Neon -> Supabase');
    console.log('--------------------------------------------------');

    const neonClient = await neonPool.connect();
    const supaClient = await supabasePool.connect();

    try {
        // 1. EXTRAÇÃO DE DADOS (NEON)
        console.log('📥 1. Lendo dados do Neon...');
        
        let invoices = [];
        let claims = [];
        
        try {
            const invoicesRes = await neonClient.query('SELECT * FROM invoices');
            invoices = invoicesRes.rows;
            console.log(`   🔸 Invoices encontrados: ${invoices.length}`);
        } catch(e) { console.log('   ⚠️ Tabela invoices não encontrada ou vazia no Neon.', e.message); }
        
        try {
            const claimsRes = await neonClient.query('SELECT * FROM faucet_claims');
            claims = claimsRes.rows;
            console.log(`   🔸 Faucet claims encontrados: ${claims.length}`);
        } catch(e) { console.log('   ⚠️ Tabela faucet_claims não encontrada ou vazia no Neon.'); }

        // 2. SETUP DE SCHEMA (SUPABASE)
        console.log('\n🏗️  2. Criando tabelas no Supabase (se não existirem)...');
        await supaClient.query('BEGIN');

        await supaClient.query(`
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
        `);

        await supaClient.query(`
            CREATE TABLE IF NOT EXISTS faucet_claims (
                id SERIAL PRIMARY KEY,
                wallet_address VARCHAR(42) NOT NULL,
                ip_address VARCHAR(45),
                amount DECIMAL(20, 6) NOT NULL,
                tx_hash VARCHAR(66) NOT NULL,
                claimed_at BIGINT NOT NULL
            );
        `);

        await supaClient.query(`
            CREATE INDEX IF NOT EXISTS idx_faucet_wallet ON faucet_claims(wallet_address);
        `);
        console.log('   ✅ Schemas criados com sucesso.');

        // 3. INJEÇÃO DE DADOS (SUPABASE)
        console.log('\n📤 3. Injetando dados no Supabase...');
        
        // Invoices
        if (invoices.length > 0) {
            console.log(`   ⏳ Restoring ${invoices.length} invoices...`);
            for (const inv of invoices) {
                // Check if exists first
                const exists = await supaClient.query('SELECT id FROM invoices WHERE id = $1', [inv.id]);
                if (exists.rowCount === 0) {
                    await supaClient.query(`
                        INSERT INTO invoices (
                            id, "fromWallet", "recipientWallet", "recipientName", 
                            amount, currency, description, status, "createdAt", 
                            "updatedAt", "txHash", payer, "paidAt"
                        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
                    `, [
                        inv.id, inv.fromWallet, inv.recipientWallet, inv.recipientName,
                        inv.amount, inv.currency, inv.description, inv.status, 
                        inv.createdAt, inv.updatedAt, inv.txHash, inv.payer, inv.paidAt
                    ]);
                }
            }
            console.log('   ✅ Invoices restore concluído.');
        }

        // Faucet Claims
        if (claims.length > 0) {
            console.log(`   ⏳ Restoring ${claims.length} faucet claims...`);
            for (const claim of claims) {
                const exists = await supaClient.query('SELECT id FROM faucet_claims WHERE id = $1', [claim.id]);
                if (exists.rowCount === 0) {
                    await supaClient.query(`
                        INSERT INTO faucet_claims (
                            id, wallet_address, ip_address, amount, tx_hash, claimed_at
                        ) VALUES ($1, $2, $3, $4, $5, $6)
                    `, [
                        claim.id, claim.wallet_address, claim.ip_address, 
                        claim.amount, claim.tx_hash, claim.claimed_at
                    ]);
                }
            }
            // Reset Sequencer for Serial Primary Key
            await supaClient.query(`
                SELECT setval('faucet_claims_id_seq', (SELECT MAX(id) FROM faucet_claims));
            `);
            console.log('   ✅ Faucet claims restore concluído e Sequence resetado.');
        }

        await supaClient.query('COMMIT');
        
        console.log('\n📊 4. Validação de Segurança (Data Loss = 0)');
        const finalInv = await supaClient.query('SELECT COUNT(*) FROM invoices');
        const finalClaims = await supaClient.query('SELECT COUNT(*) FROM faucet_claims');
        
        console.log(`   🔹 Neon Invoices: ${invoices.length} | Supabase Invoices: ${finalInv.rows[0].count}`);
        console.log(`   🔹 Neon Claims: ${claims.length} | Supabase Claims: ${finalClaims.rows[0].count}`);
        
        if (parseInt(finalInv.rows[0].count) >= invoices.length && parseInt(finalClaims.rows[0].count) >= claims.length) {
            console.log('\n🎯 SUCESSO ABSOLUTO! Dados migrados 100% com segurança.');
        } else {
            console.log('\n⚠️ ALERTA: Diferença detectada na contagem final. Revise o log.');
        }

    } catch (error) {
        await supaClient.query('ROLLBACK');
        console.error('\n❌ ERRO FATAL: Migração abortada.', error);
    } finally {
        neonClient.release();
        supaClient.release();
        await neonPool.end();
        await supabasePool.end();
        console.log('--------------------------------------------------');
        console.log('🏁 Processo finalizado.');
    }
}

migrate();
