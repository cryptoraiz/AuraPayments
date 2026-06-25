import { useState, useEffect, useCallback } from 'react';
import { useAccount, useChainId } from 'wagmi';
import { invoiceAPI } from '../services/invoiceService';
import { arcTestnet } from '../config/wagmi';
import { getBlacklist } from '../utils/localStorage';

/**
 * Hook to manage invoice notifications for the connected wallet
 * Features:
 * - Real-time local expiration check (1s interval)
 * - Auto-polling from API (10s interval)
 * - Blacklist support (removes locally deleted items)
 */
export const useInvoiceNotifications = () => {
    const { address, isConnected } = useAccount();
    const chainId = useChainId();

    // "Raw" data from API (before local time filtering)
    const [rawInvoices, setRawInvoices] = useState([]);

    // Processed list for UI
    const [pendingInvoices, setPendingInvoices] = useState([]);

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [lastChecked, setLastChecked] = useState(null);

    // --- 1. Filter Logic (Runs locally every second) ---
    const updatePendingList = useCallback(() => {
        if (!rawInvoices.length && !pendingInvoices.length) return;

        const blacklist = getBlacklist();
        const now = Date.now();

        const pending = rawInvoices.filter((inv) => {
            // Must be pending status
            if (inv.status !== 'pending') return false;

            // Must not be in blacklist (deleted by user)
            if (blacklist.includes(inv.id)) return false;

            // Must not be expired (5-minute test rule)
            // This is the "Real-Time" part: as 'now' advances, items drop automatically
            const created = new Date(Number(inv.createdAt)).getTime();
            const isExpired = (now - created) > (5 * 60 * 1000);

            return !isExpired;
        });

        // Only update state if length changes (avoids unnecessary re-renders)
        // We use function form to compare with *current* state
        setPendingInvoices(prev => {
            if (prev.length === pending.length) {
                // Determine if content is identical (optimization)
                const prevIds = prev.map(i => i.id).join(',');
                const newIds = pending.map(i => i.id).join(',');
                if (prevIds === newIds) return prev;
            }
            return pending;
        });
    }, [rawInvoices]); // Dependency only on raw data, not "now" (handled by interval)

    // --- 2. Data Sync (Runs less frequently) ---
    const fetchInvoices = useCallback(async () => {
        if (!isConnected || !address || chainId !== arcTestnet.id) {
            setRawInvoices([]);
            setPendingInvoices([]);
            return;
        }

        // Only set loading on first load to avoid flickering
        if (!rawInvoices.length) setLoading(true);
        setError(null);

        try {
            const invoices = await invoiceAPI.getByWallet(address);
            setRawInvoices(invoices); // Raw data saved, filtering cycle picks it up next tick
            setLastChecked(Date.now());
        } catch (err) {
            console.error('Error fetching invoices:', err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [address, isConnected, chainId]);

    // Effect: Initial Fetch + Data Polling (10s) + Event Listener
    useEffect(() => {
        if (!isConnected || !address) return;

        fetchInvoices();

        // Poll every 10s
        const interval = setInterval(fetchInvoices, 10000);

        // Listen for manual updates (Creation/Deletion)
        const handleUpdate = () => {
            fetchInvoices();
        };
        window.addEventListener('invoice_updated', handleUpdate);

        return () => {
            clearInterval(interval);
            window.removeEventListener('invoice_updated', handleUpdate);
        };
    }, [fetchInvoices, address, isConnected]);

    // Effect: Local Filter Polling (1s) - This drives the "Real Time" expiration
    useEffect(() => {
        // Run immediately on rawInvoices update
        updatePendingList();

        // Run every second to check for expiration
        const interval = setInterval(updatePendingList, 1000);
        return () => clearInterval(interval);
    }, [updatePendingList]); // updatePendingList depends on rawInvoices, so this resets when data updates

    const refresh = useCallback(() => {
        fetchInvoices();
    }, [fetchInvoices]);

    return {
        pendingInvoices,
        loading,
        error,
        lastChecked,
        refresh,
        count: pendingInvoices.length,
    };
};
