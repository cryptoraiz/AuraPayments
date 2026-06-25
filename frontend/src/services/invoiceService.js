/**
 * API Service for Invoice Management
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://arc-invoice-backend.vercel.app';

export const invoiceAPI = {
    /**
     * Create a new invoice
     */
    async create(invoiceData) {
        try {
            const response = await fetch(`${API_BASE_URL}/api/invoices/create`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(invoiceData),
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error('Error creating invoice:', error);
            throw error;
        }
    },

    /**
     * Get invoices for a wallet address
     */
    async getByWallet(walletAddress) {
        try {
            const response = await fetch(
                `${API_BASE_URL}/api/invoices/${walletAddress}`,
                {
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                }
            );

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            return data.invoices || [];
        } catch (error) {
            console.error('Error fetching invoices:', error);
            return [];
        }
    },

    /**
     * Get a single invoice by ID
     */
    async getById(id) {
        try {
            const response = await fetch(
                `${API_BASE_URL}/api/invoices/get?id=${id}`,
                {
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                }
            );

            if (!response.ok) {
                if (response.status === 404) return null;
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            return data.invoice || null;
        } catch (error) {
            console.error('Error fetching invoice by ID:', error);
            throw error; // Propagate error to caller
        }
    },

    /**
     * Update invoice status
     */
    async updateStatus(id, status, additionalData = {}) {
        try {
            const response = await fetch(`${API_BASE_URL}/api/invoices/update`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    id,
                    status,
                    ...additionalData,
                }),
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error('Error updating invoice:', error);
            throw error;
        }
    },

    /**
     * Delete invoices for a wallet with optional scope
     */
    async deleteByWallet(walletAddress, scope = 'all') {
        try {
            const response = await fetch(
                `${API_BASE_URL}/api/invoices/${walletAddress}?scope=${scope}`,
                {
                    method: 'DELETE',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                }
            );

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error('Error deleting invoices:', error);
            throw error;
        }
    }
};
