// import { getInvoicesCollection } from '../../lib/mongodb.js'; // Removed for Postgres migration

/**
 * POST /api/invoices/create
 * Create a new invoice
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

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const {
            id,
            fromWallet,
            toWallet,
            recipientName,
            amount,
            currency,
            description
        } = req.body;

        // Validation
        if (!id || !fromWallet || !toWallet || !amount || !currency) {
            return res.status(400).json({
                error: 'Missing required fields: id, fromWallet, toWallet, amount, currency'
            });
        }

        // Construct the invoice object
        const invoice = {
            id,
            fromWallet,
            recipientWallet: toWallet, // Store as recipientWallet internally for consistency
            recipientName: recipientName || 'Unknown',
            amount,
            currency,
            description: description || '',
            status: 'pending',
            createdAt: Date.now()
        };

        // Use JSON Store for now (High reliability fallback)
        // const collection = await getInvoicesCollection();
        // await collection.insertOne(invoice);

        const { db } = await import('../../lib/store.js');
        await db.add(invoice);

        res.status(201).json({
            success: true,
            invoiceId: id,
            message: 'Invoice created successfully'
        });

    } catch (error) {
        console.error('Error creating invoice:', error);
        res.status(500).json({
            error: 'Internal server error',
            message: error.message
        });
    }
}
