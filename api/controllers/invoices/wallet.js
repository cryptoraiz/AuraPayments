// import { getInvoicesCollection } from '../../lib/mongodb.js'; // Removed for Postgres migration

/**
 * GET /api/invoices/[wallet]
 * Get all invoices for a specific wallet address (as recipient)
 */
export default async function handler(req, res) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
    );

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const wallet = req.query.wallet || req.params.wallet;

        if (!wallet) {
            return res.status(400).json({ error: 'Wallet address required' });
        }

        // Use JSON Store for now
        // const collection = await getInvoicesCollection();
        // const invoices = await collection.find(...).toArray();

        const { db } = await import('../../lib/store.js');

        console.log(`🔍 Searching invoices for wallet: ${wallet}`);
        const invoices = await db.findByWallet(wallet);
        console.log(`✅ Found ${invoices.length} invoices for ${wallet}`);

        // Remove MongoDB _id field from response (already clean in JSON)
        const cleanedInvoices = invoices;

        res.status(200).json({
            success: true,
            count: cleanedInvoices.length,
            invoices: cleanedInvoices
        });

    } catch (error) {
        console.error('Error fetching invoices:', error);
        res.status(500).json({
            error: 'Internal server error',
            message: error.message
        });
    }
}
