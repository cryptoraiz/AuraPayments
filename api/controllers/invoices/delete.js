import { db } from '../../lib/store.js';

/**
 * DELETE /api/invoices/:wallet
 * Delete all invoices for a wallet
 */
export default async function handler(req, res) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'DELETE') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const wallet = req.params?.wallet || req.query?.wallet;

        if (!wallet) {
            return res.status(400).json({ error: 'Wallet address required' });
        }

        const count = await db.deleteByWallet(wallet);

        console.log(`🗑️ Deleted ${count} invoices for wallet ${wallet}`);

        res.status(200).json({
            success: true,
            message: `Deleted ${count} invoices associated with wallet`,
            count
        });
    } catch (error) {
        console.error('Error deleting invoices:', error);
        res.status(500).json({
            error: 'Internal server error',
            message: error.message
        });
    }
}
