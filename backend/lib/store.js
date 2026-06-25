import pg from 'pg';
const { Pool } = pg;

// Use POSTGRES_URL from environment variables (standard for Vercel/Railway)
const connectionString = process.env.SUPABASE_DB_URL || process.env.POSTGRES_URL;

if (!connectionString) {
    console.warn('⚠️ POSTGRES_URL not set. Database features will fail.');
}

// Create a new pool using the connection string
// SSL is usually required for cloud databases (Neon, Railway, Vercel)

// FIX: Force BigInt (OID 20) to be parsed as Number in JS
// This fixes "NaN" dates because pg by default returns BigInt as string
pg.types.setTypeParser(20, (val) => parseInt(val, 10));

// Singleton Pool Pattern for Serverless
let pool;

function getPool() {
    if (!pool) {
        pool = new Pool({
            connectionString,
            ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
            max: 3, // Serverless limit override (keep low to avoid exhaustion)
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 5000,
        });
    }
    return pool;
}

export const db = {
    /**
     * Helper to run queries
     */
    async query(text, params) {
        return getPool().query(text, params);
    },

    async getAll() {
        const res = await this.query('SELECT * FROM invoices ORDER BY "createdAt" DESC');
        return res.rows;
    },

    async add(invoice) {
        const query = `
            INSERT INTO invoices (
                id, "fromWallet", "recipientWallet", "recipientName", 
                amount, currency, description, status, "createdAt", "updatedAt"
            ) 
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            RETURNING *
        `;
        const values = [
            invoice.id,
            invoice.fromWallet,
            invoice.recipientWallet,
            invoice.recipientName,
            invoice.amount,
            invoice.currency,
            invoice.description,
            invoice.status,
            invoice.createdAt, // Assumes BigInt or numeric timestamp
            invoice.updatedAt || null
        ];

        const res = await this.query(query, values);
        return res.rows[0];
    },

    async findById(id) {
        const res = await this.query('SELECT * FROM invoices WHERE id = $1', [id]);
        return res.rows[0] || null;
    },

    async findByWallet(wallet) {
        // Find invoices where wallet is Creator (fromWallet) OR Recipient (recipientWallet)
        // Optimized with LOWER() index
        const res = await this.query(
            'SELECT * FROM invoices WHERE LOWER("fromWallet") = LOWER($1) OR LOWER("recipientWallet") = LOWER($1) ORDER BY "createdAt" DESC',
            [wallet]
        );
        return res.rows;
    },

    async updateStatus(id, status, additionalFields = {}) {
        // OPTIMISTIC LOCKING / CONCURRENCY GUARD
        // Only update if status is NOT ALREADY 'paid' (unless we are intentionally forcing it, but usually not)
        // This prevents double-spending or duplicate processing race conditions

        const fields = ['status = $2', '"updatedAt" = $3'];
        const values = [id, status, Date.now()];
        let paramIndex = 4;

        // Add additional fields dynamically
        Object.keys(additionalFields).forEach(key => {
            fields.push(`"${key}" = $${paramIndex}`);
            values.push(additionalFields[key]);
            paramIndex++;
        });

        // The WHERE clause acts as the guard
        // We only allow transition TO 'paid' if current status is NOT 'paid'.
        // If status is 'pending', allow update. If 'expired', allow update.
        // If query returns empty row, it means it was already paid or id doesn't exist.

        let guardClause = '';
        if (status === 'paid') {
            guardClause = `AND status != 'paid'`;
        }

        const query = `
            UPDATE invoices 
            SET ${fields.join(', ')} 
            WHERE id = $1 ${guardClause}
            RETURNING *
        `;

        const res = await this.query(query, values);

        // If no rows returned but we wanted to pay, check if it was already paid
        if (!res.rows[0] && status === 'paid') {
            console.warn(`⚠️ Race condition averted or Idempotency check: Invoice ${id} was already paid.`);
            // Return existing invoice to prevent frontend error, but don't re-process logic
            const existing = await this.findById(id);
            return existing;
        }

        return res.rows[0] || null;
    },

    async deleteByWallet(wallet) {
        const query = 'DELETE FROM invoices WHERE LOWER("fromWallet") = LOWER($1) OR LOWER("recipientWallet") = LOWER($1)';
        const res = await this.query(query, [wallet]);
        return res.rowCount; // Returns number of deleted rows
    }
};
