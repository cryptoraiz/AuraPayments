import { useState, useEffect, useRef, useCallback } from 'react';
import { useAccount, useConnect } from 'wagmi';
import { getPaymentLinksByWallet, getSentPaymentsByWallet, clearPaymentLinksByScope, clearSentPaymentsByScope, getBlacklist, syncLocalLinks } from '../../utils/localStorage';
import { invoiceAPI } from '../../services/invoiceService';
import { motion, AnimatePresence } from 'framer-motion';
import { generateBatchReceipts } from '../../utils/generateReceipt';
import WalletModal from './WalletModal';

const safeDate = (val) => {
    if (!val) return new Date();
    if (typeof val === 'number') return new Date(val);
    if (typeof val === 'string' && /^\d+$/.test(val)) return new Date(parseInt(val, 10));
    const d = new Date(val);
    return isNaN(d.getTime()) ? new Date() : d;
};

export default function InvoiceHistory({ onUpdateStats }) {
    const { address, isConnected } = useAccount();
    const { connect, connectors } = useConnect();
    const [showWalletModal, setShowWalletModal] = useState(false);
    const [receivedLinks, setReceivedLinks] = useState([]);
    const [sentPayments, setSentPayments] = useState([]);
    const [activeTab, setActiveTab] = useState('all'); // all, received, pending, expired, sent
    const [searchTerm, setSearchTerm] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [showSettingsDropdown, setShowSettingsDropdown] = useState(false);

    const handleWalletSelect = (connector) => {
        connect({ connector });
        setShowWalletModal(false);
    };

    // Initial loading effect
    useEffect(() => {
        const timer = setTimeout(() => setIsLoading(false), 2000); // Fail-safe fallback
        return () => clearTimeout(timer);
    }, []);

    // Pagination State
    const [currentPage, setCurrentPage] = useState(1);
    const ITEMS_PER_PAGE = 4;

    // Notification State
    const [toasts, setToasts] = useState([]);
    const [showClearModal, setShowClearModal] = useState(false);
    const [isClearing, setIsClearing] = useState(false);
    const prevReceivedRef = useRef([]);

    // Toast Helper
    const addToast = (title, message) => {
        const id = Date.now();
        setToasts(prev => [...prev, { id, title, message }]);
        setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 5000);
    };

    const fetchHistory = useCallback(async () => {
        if (!isConnected || !address) {
            setReceivedLinks([]);
            setSentPayments([]);
            setIsLoading(false);
            return;
        }

        const receivedLocal = getPaymentLinksByWallet(address);
        const sentLocal = getSentPaymentsByWallet(address);

        try {
            // Polling history for address
            const backendInvoices = await invoiceAPI.getByWallet(address);

            const backendReceivedItems = backendInvoices.map(inv => ({
                id: inv.id,
                creatorAddress: inv.fromWallet,
                recipientName: inv.recipientName || 'Payment Received',
                recipientWallet: inv.recipientWallet,
                amount: inv.amount,
                currency: inv.currency,
                description: inv.description,
                status: inv.status,
                createdAt: inv.createdAt,
                paidAt: inv.paidAt,
                txHash: inv.txHash,
                payer: inv.payer,
                isBackend: true
            }));

            // Merge Logic (Backend Priority)
            const allReceived = [...receivedLocal, ...backendReceivedItems].filter(Boolean);
            let uniqueReceived = Array.from(new Map(allReceived.map(item => [item.id, item])).values());

            // Filter out blacklisted (locally deleted) items
            const blacklist = getBlacklist();
            if (blacklist.length > 0) {
                uniqueReceived = uniqueReceived.filter(item => !blacklist.includes(item.id));
            }

            // CRITICAL FIX: Ghost Transaction Prevention
            // If I am the payer (fromWallet matches my address), I should NOT see this in "Received"
            // This prevents "Self-Funding" tests from showing up as duplicate +100 and -100
            uniqueReceived = uniqueReceived.filter(item => {
                const isMyPayment = item.payer && item.payer.toLowerCase() === address.toLowerCase();
                const isMyCreation = item.creatorAddress && item.creatorAddress.toLowerCase() === address.toLowerCase();

                // Keep if I created it (Creator View) OR if I am the recipient
                // BUT if I paid it (Payer View), it belongs in 'Sent', not 'Received'
                // However, for ArcInvoice standard:
                // Received Tab = Links I created (regardless of who paid, even me)
                // Sent Tab = Payments I made

                return true; // Logic revisited below in 'displayedItems' to handle visual duplication if needed
            });

            // Notification Logic: Check for new 'paid' status
            uniqueReceived.forEach(newItem => {
                if (newItem.status === 'paid') {
                    const oldItem = prevReceivedRef.current.find(old => old.id === newItem.id);
                    // Trigger if it wasn't paid before (or is new and paid)
                    // Only if oldItem existed and was NOT paid (avoid notification on first load if refined, but here handles 'just paid')
                    if (oldItem && oldItem.status !== 'paid') {
                        addToast('Payment Received! 💰', `Received ${newItem.amount} ${newItem.currency} from ${newItem.recipientName}`);
                    }
                }
            });

            // Update State and Ref
            setReceivedLinks(uniqueReceived);
            prevReceivedRef.current = uniqueReceived;
            setSentPayments(sentLocal);

        } catch (err) {
            console.error('❌ Polling error:', err);
            // Fallback to local only on error for first load
            setReceivedLinks(prev => {
                if (prev.length === 0) return receivedLocal;
                return prev;
            });
        } finally {
            setIsLoading(false);
        }
    }, [address, isConnected]);

    // Polling Effect
    useEffect(() => {
        setIsLoading(true); // Reset load on mount/address change
        fetchHistory(); // Initial fetch
        const interval = setInterval(fetchHistory, 5000); // 5s Poll
        return () => clearInterval(interval);
    }, [fetchHistory]);

    // --- Stats Computation ---
    const totalReceived = receivedLinks
        .filter(i => i.status === 'paid')
        .reduce((acc, curr) => acc + parseFloat(curr.amount || 0), 0);

    const totalSent = sentPayments
        .reduce((acc, curr) => acc + parseFloat(curr.amount || 0), 0);

    const formattedTotalReceived = totalReceived.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const formattedTotalSent = totalSent.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    const pendingCount = receivedLinks.filter(i => i.status === 'pending').length;
    const completedCount = receivedLinks.filter(i => i.status === 'paid').length;

    useEffect(() => {
        if (onUpdateStats) {
            onUpdateStats({ pendingCount, completedCount });
        }
    }, [pendingCount, completedCount, onUpdateStats]);

    // --- Filtering Logic ---
    let displayedItems = [];

    // Helper to check if expired (older than 24h)
    const isExpired = (item) => {
        if (item.status === 'paid') return false;
        const created = safeDate(item.createdAt).getTime();
        const now = Date.now();
        const expirationTime = 24 * 60 * 60 * 1000; // 24h Production expiration
        return (now - created) > expirationTime;
    };

    // Helper for countdown display
    const getTimeRemaining = (createdAt) => {
        const created = safeDate(createdAt).getTime();
        const now = Date.now();
        const expirationTime = 24 * 60 * 60 * 1000; // 24h Production expiration
        const diff = (created + expirationTime) - now;

        if (diff <= 0) return 'Expired';
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
    };

    const receivedItems = receivedLinks.map(i => ({ ...i, type: 'received' }));
    const sentItems = sentPayments.map(i => ({ ...i, type: 'sent', status: 'paid' }));

    switch (activeTab) {
        case 'received':
            displayedItems = receivedItems.filter(i => i.status === 'paid');
            break;
        case 'pending':
            displayedItems = receivedItems.filter(i => i.status === 'pending' && !isExpired(i));
            break;
        case 'expired':
            displayedItems = receivedItems.filter(i => i.status === 'pending' && isExpired(i));
            break;
        case 'sent':
            displayedItems = sentItems;
            break;
        case 'all':
        default:
            // Standard View: Show EVERYTHING (Sent + Received)
            // If self-payment, show both -100 (Sent) and +100 (Received) so math balances out.
            // Duplicates of the SAME item are already handled by the Map() unique filtering above.
            displayedItems = [...receivedItems, ...sentItems];
            break;
    }

    // Sort by dates
    displayedItems.sort((a, b) => {
        const dateA = a.paidAt || a.createdAt;
        const dateB = b.paidAt || b.createdAt;
        return safeDate(dateB) - safeDate(dateA);
    });

    // Apply Search
    if (searchTerm) {
        displayedItems = displayedItems.filter(item =>
            item.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            item.recipientName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            item.amount?.toString().includes(searchTerm)
        );
    }

    // Apply Pagination
    const paginatedItems = displayedItems.slice(0, 5);


    const [copiedId, setCopiedId] = useState(null);

    const copyLink = (id) => {
        const url = `${window.location.origin}/pay/${id}`;
        navigator.clipboard.writeText(url);
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 2000);
    };

    const generatePaymentReceipt = (item) => {
        import('../../utils/generateReceipt').then(module => {
            module.generatePaymentReceipt(item);
            addToast('Receipt Generated', `Receipt for ${item.recipientName} is ready.`);
        });
    };

    const handleExportData = () => {
        let exportItems = [];
        // Filter export based on active tab
        if (activeTab === 'all') {
            // Only export COMPLETED transactions (Received Paid + Sent)
            const paidReceived = receivedItems.filter(i => i.status === 'paid');
            exportItems = [...paidReceived, ...sentItems];
        }
        else if (activeTab === 'received') exportItems = receivedItems.filter(i => i.status === 'paid');
        else if (activeTab === 'pending') exportItems = receivedItems.filter(i => i.status === 'pending' && !isExpired(i));
        else if (activeTab === 'expired') exportItems = receivedItems.filter(i => i.status === 'pending' && isExpired(i));
        else if (activeTab === 'sent') exportItems = sentItems;

        if (exportItems.length === 0) {
            addToast('Nothing to export', `No items found in ${activeTab.toUpperCase()} tab.`);
            return;
        }
        generateBatchReceipts(exportItems, address);
        addToast('Backup Started', `Downloading PDF for ${activeTab.toUpperCase()} items.`);
    };

    const handleClearData = async () => {
        try {
            setIsClearing(true);
            const scope = activeTab; // 'all', 'received', 'pending', 'expired', 'sent'

            // CRITICAL: Sync local storage statuses with current view before deleting
            // This prevents "Paid" items (which might be 'pending' in local storage) from being deleted as "Expired"
            syncLocalLinks(receivedLinks);

            // Clear Local
            clearPaymentLinksByScope(scope, address);
            clearSentPaymentsByScope(scope, address);

            // Clear Backend
            if (isConnected && address) {
                await invoiceAPI.deleteByWallet(address, scope);
            }

            addToast('Activity Cleared', `${scope.toUpperCase()} data has been deleted.`);

            // Notify other components (Navbar badge) to update immediately
            window.dispatchEvent(new Event('invoice_updated'));

            setShowClearModal(false);

            setTimeout(() => {
                window.location.reload();
            }, 2000);

        } catch (error) {
            console.error('Error clearing activity:', error);
            addToast('Error', 'Failed to clear server activity.');
            setShowClearModal(false);
        } finally {
            setIsClearing(false);
        }
    };

    // Skeleton Component
    const HistorySkeleton = () => (
        <div className="group relative bg-dark-card border border-dark-border rounded-xl p-4 animate-pulse">
            <div className="flex items-center justify-between gap-4">
                <div className="w-10 h-10 rounded-xl bg-white/10 shrink-0"></div>
                <div className="flex-1 min-w-0 space-y-2">
                    <div className="h-4 bg-white/10 rounded w-1/3"></div>
                    <div className="h-3 bg-white/5 rounded w-1/4"></div>
                </div>
                <div className="text-right pl-4 space-y-2">
                    <div className="h-6 bg-white/10 rounded w-20 ml-auto"></div>
                </div>
            </div>
        </div>
    );

    if (!isConnected) return (
        <>
            <section className="flex-1 flex flex-col items-center justify-center p-8 min-h-0 w-full relative overflow-hidden">
                {/* Background Decoration */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-blue-500/10 rounded-full blur-[100px] pointer-events-none"></div>

                <div className="relative w-full max-w-md">
                    {/* Glass Card */}
                    <div className="relative bg-dark-card border border-dark-border rounded-3xl p-8 md:p-10 text-center shadow-2xl overflow-hidden">

                        {/* Glow Gradient Top */}
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-blue-500/50 to-transparent"></div>

                        {/* Icon Container with Animation */}
                        <div className="relative mb-8 mx-auto w-24 h-24">
                            <div className="absolute inset-0 bg-blue-500/20 rounded-full blur-xl animate-pulse"></div>
                            <div className="relative w-full h-full bg-gradient-to-br from-blue-500/10 to-purple-500/10 rounded-full border border-white/10 flex items-center justify-center p-5">
                                <svg className="w-10 h-10 text-blue-400 drop-shadow-[0_0_10px_rgba(96,165,250,0.5)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                </svg>
                            </div>
                        </div>

                        {/* Text Content */}
                        <h2 className="text-2xl md:text-3xl font-bold text-white mb-3 tracking-tight">
                            Connect your wallet
                        </h2>
                        <p className="text-gray-400 text-base leading-relaxed mb-8">
                            Connect your wallet to securely access your transaction activity, invoices, and payment status.
                        </p>

                        <button
                            onClick={() => setShowWalletModal(true)}
                            className="w-full mt-2 py-4 rounded-2xl transition-all active:scale-[0.98] bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.05] text-white font-bold text-lg"
                        >
                            Connect Wallet
                        </button>

                        <div className="mt-6 flex justify-center gap-4 text-xs text-gray-500 font-medium">
                            <span className="flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                Secure
                            </span>
                            <span className="flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                                Private
                            </span>
                            <span className="flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-purple-500"></span>
                                Encrypted
                            </span>
                        </div>
                    </div>
                </div>
            </section>

            <WalletModal
                isOpen={showWalletModal}
                onClose={() => setShowWalletModal(false)}
                connectors={connectors}
                onSelectWallet={handleWalletSelect}
            />
        </>
    );

    return (
        <section className="flex-1 flex flex-col px-4 md:px-0 py-2 min-h-[540px] w-full items-center">
            <div className="w-full max-w-4xl flex flex-col flex-1 min-h-[540px] space-y-4">

                {/* Header & Controls Container */}
                <div className="flex flex-col gap-4 opacity-0 animate-[fadeIn_0.5s_ease-out_forwards]">

                    {/* Stats Row */}
                    <div className="space-y-4">
                        {/* Row 1 - Monetary Values Only */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="relative bg-dark-card border border-dark-border p-5 rounded-2xl flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-medium text-zinc-400 mb-1">Total Received</p>
                                    <p className="text-2xl font-bold text-white tracking-tight">${formattedTotalReceived}</p>
                                </div>
                                <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                </div>
                            </div>
                            <div className="relative bg-dark-card border border-dark-border p-5 rounded-2xl flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-medium text-zinc-400 mb-1">Total Sent</p>
                                    <p className="text-2xl font-bold text-white tracking-tight">${formattedTotalSent}</p>
                                </div>
                                <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center text-red-500">
                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Controls Row */}
                    <div className="flex w-full items-center justify-between gap-3">
                        {/* Tabs */}
                        <div className="flex items-center gap-1 bg-dark-input p-1 rounded-xl border border-dark-border/50 overflow-x-auto hide-scrollbar flex-1 min-w-0">
                            {['All', 'Received', 'Pending', 'Expired', 'Sent'].map((tabLabel) => {
                                const key = tabLabel === 'All' ? 'all' :
                                    tabLabel === 'Received' ? 'received' :
                                        tabLabel === 'Pending' ? 'pending' :
                                            tabLabel === 'Expired' ? 'expired' : 'sent';
                                const isActive = activeTab === key;

                                // Define conditional colors
                                let activeColorClass = 'text-white';
                                let inactiveColorClass = 'text-zinc-500 hover:text-white';

                                if (tabLabel === 'Received') {
                                    activeColorClass = 'text-emerald-400';
                                    inactiveColorClass = 'text-emerald-600 hover:text-emerald-400';
                                } else if (tabLabel === 'Sent') {
                                    activeColorClass = 'text-rose-400';
                                    inactiveColorClass = 'text-rose-600 hover:text-rose-400';
                                } else if (tabLabel === 'Pending') {
                                    activeColorClass = 'text-amber-400';
                                    inactiveColorClass = 'text-amber-600 hover:text-amber-400';
                                } else if (tabLabel === 'Expired') {
                                    activeColorClass = 'text-zinc-400';
                                    inactiveColorClass = 'text-zinc-600 hover:text-zinc-400';
                                }

                                return (
                                    <button
                                        key={key}
                                        onClick={() => {
                                            setActiveTab(key);
                                            setCurrentPage(1);
                                            setShowSettingsDropdown(false); // close settings if tab changes
                                        }}
                                        className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${isActive
                                            ? `bg-dark-card border border-dark-border shadow-lg ${activeColorClass}`
                                            : `${inactiveColorClass} hover:bg-dark-bg`
                                            }`}
                                    >
                                        {tabLabel}
                                    </button>
                                );
                            })}
                        </div>

                        {/* Settings Gear */}
                        <div className="relative shrink-0">
                            <button
                                onClick={() => setShowSettingsDropdown(!showSettingsDropdown)}
                                className={`p-2 rounded-xl border transition-all flex items-center justify-center ${showSettingsDropdown
                                    ? 'bg-blue-500/10 border-blue-500/20 text-blue-400 shadow-[0_0_15px_rgba(59,130,246,0.1)]'
                                    : 'bg-dark-input border-dark-border/50 text-zinc-400 hover:text-white hover:border-white/10 hover:bg-dark-card'}`}
                            >
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                </svg>
                            </button>
                        </div>
                    </div>
                </div>

                {/* Links List / Settings Overlay Container */}
                <div className="flex-1 pb-8 relative flex flex-col">
                    <AnimatePresence>
                        {showSettingsDropdown && (
                            <motion.div
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                transition={{ duration: 0.2 }}
                                className="absolute inset-0 z-50 flex flex-col bg-dark-bg/40 backdrop-blur-md rounded-2xl p-4 md:p-8"
                            >
                                <div className="w-full max-w-md mx-auto bg-dark-card border border-dark-border rounded-2xl shadow-2xl p-6 flex flex-col gap-4">
                                    <div className="flex items-center justify-between border-b border-white/5 pb-4">
                                        <h3 className="text-white font-bold text-lg flex items-center gap-2">
                                            <svg className="w-5 h-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                            </svg>
                                            Configuration
                                        </h3>
                                        <button 
                                            onClick={() => setShowSettingsDropdown(false)}
                                            className="text-zinc-500 hover:text-white transition-colors"
                                        >
                                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                        </button>
                                    </div>
                                    
                                    <div className="flex flex-col gap-3">
                                        {(activeTab === 'received' || activeTab === 'sent') && (
                                            <button
                                                onClick={() => {
                                                    handleExportData();
                                                    setShowSettingsDropdown(false);
                                                }}
                                                className="w-full text-left px-4 py-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-sm font-bold text-blue-400 hover:bg-blue-500/20 flex items-center gap-3 transition-colors"
                                            >
                                                <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
                                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                                                </div>
                                                Download Receipts (PDF)
                                            </button>
                                        )}
                                        <button
                                            onClick={() => {
                                                setShowClearModal(true);
                                                setShowSettingsDropdown(false);
                                            }}
                                            className="w-full text-left px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-sm font-bold text-red-400 hover:bg-red-500/20 flex items-center gap-3 transition-colors"
                                        >
                                            <div className="w-8 h-8 rounded-lg bg-red-500/20 flex items-center justify-center">
                                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                </svg>
                                            </div>
                                            Clear {activeTab === 'all' ? 'All Data' : activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}
                                        </button>
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    <div className="space-y-3 flex-1 flex flex-col">
                    {/* Top Pagination Controls Removed */}

                    {isLoading && paginatedItems.length === 0 ? (
                        <div className="grid gap-3">
                            {[1, 2, 3, 4].map((i) => (
                                <HistorySkeleton key={i} />
                            ))}
                        </div>
                    ) : paginatedItems.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 text-zinc-600 space-y-4">
                            <div className="w-16 h-16 rounded-full bg-zinc-900 flex items-center justify-center">
                                <svg className="w-6 h-6 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
                            </div>
                            <p className="text-sm font-medium">No activity found</p>
                        </div>
                    ) : (
                        <div className="grid gap-2" key={activeTab}>
                            {paginatedItems.map(item => (
                                <div key={item.id} className="group relative bg-dark-card border border-dark-border rounded-xl px-4 py-3 transition-all hover:border-dark-border/80 hover:bg-dark-input">
                                    <div className="flex items-center justify-between gap-3">

                                        {/* Left Icon */}
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 border ${item.type === 'sent' ? 'bg-red-500/10 border-red-500/20 text-red-500' :
                                            item.status === 'paid' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500' :
                                                (item.status === 'pending' && isExpired(item)) ? 'bg-zinc-800 border-zinc-700 text-zinc-500' :
                                                    'bg-amber-500/10 border-amber-500/20 text-amber-500'
                                            }`}>
                                            {item.type === 'sent' ? (
                                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                                                </svg>
                                            ) : item.status === 'paid' ? (
                                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                                                </svg>
                                            ) : (item.status === 'pending' && isExpired(item)) ? (
                                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                                </svg>
                                            ) : (
                                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                </svg>
                                            )}
                                        </div>

                                        {/* Main Content */}
                                        <div className="flex-1 min-w-0">
                                            {/* Row 1: Name */}
                                            <div className="flex items-center gap-2 mb-0.5">
                                                <h3 className="text-sm font-bold text-white truncate">{item.recipientName}</h3>
                                            </div>

                                            {/* Row 2: Date + Timer + Actions */}
                                            <div className="flex flex-wrap items-center gap-3 mt-1">
                                                <div className="flex items-center gap-2">
                                                    {item.status === 'pending' && !isExpired(item) && (
                                                        <span className="text-[10px] font-bold text-amber-500 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20 flex items-center gap-1">
                                                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                                            {getTimeRemaining(item.createdAt)}
                                                        </span>
                                                    )}
                                                    <p className="text-zinc-500 text-xs font-medium">
                                                        {safeDate(item.paidAt || item.createdAt).toLocaleDateString('en-US', {
                                                            day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
                                                        })}
                                                    </p>
                                                </div>

                                                {/* Action Buttons */}
                                                <div className="flex items-center gap-2">
                                                    {/* Copy Link (Pending Received) */}
                                                    {item.status === 'pending' && !isExpired(item) && item.type === 'received' && (
                                                        <button
                                                            onClick={() => copyLink(item.id)}
                                                            className={`flex items-center gap-1.5 px-2 py-1 rounded-md transition-all text-[10px] font-bold ${copiedId === item.id
                                                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                                                : 'bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 hover:text-blue-300'
                                                                }`}
                                                        >
                                                            {copiedId === item.id ? (
                                                                <>
                                                                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                                                    </svg>
                                                                    Copied!
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 20h6a2 2 0 01-2 2h-6a2 2 0 01-2-2v-6a2 2 0 012-2z" />
                                                                    </svg>
                                                                    Copy Link
                                                                </>
                                                            )}
                                                        </button>
                                                    )}

                                                    {/* Receipt Button */}
                                                    {(item.status === 'paid' || item.type === 'sent') && (
                                                        <button
                                                            onClick={() => generatePaymentReceipt(item)}
                                                            className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:text-white transition-colors text-[10px] font-bold"
                                                        >
                                                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                                                            Receipt
                                                        </button>
                                                    )}

                                                    {/* Explorer Link */}
                                                    {item.txHash && (
                                                        <a
                                                            href={`https://testnet.arcscan.app/tx/${item.txHash}`}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="p-1 rounded-md hover:bg-white/5 text-zinc-600 hover:text-white transition-colors"
                                                            title="View on Etherscan"
                                                        >
                                                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                                                        </a>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Right Side: Amount */}
                                        <div className="text-right pl-3">
                                            <p className="flex items-baseline justify-end gap-1 text-xl md:text-2xl font-bold text-white tracking-tighter">
                                                <span className="text-zinc-600 font-medium select-none text-lg md:text-xl mr-0.5">{item.type === 'sent' ? '-' : '+'}</span>
                                                {item.amount}
                                                <span className="text-xs md:text-sm font-medium text-zinc-500 ml-1">{item.currency}</span>
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                </div>
            </div>

            {/* Notification Toast Container */}
            <div className="fixed bottom-4 right-4 z-[200] flex flex-col gap-2 pointer-events-none">
                <AnimatePresence>
                    {toasts.map(toast => (
                        <motion.div
                            key={toast.id}
                            initial={{ opacity: 0, y: 20, scale: 0.9 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, x: 20 }}
                            className="pointer-events-auto bg-zinc-900/90 border border-emerald-500/30 rounded-xl p-4 shadow-2xl shadow-emerald-900/20 w-80 flex items-start gap-3 backdrop-blur-xl"
                        >
                            <div className="p-2 bg-emerald-500/10 rounded-lg shrink-0">
                                <svg className="w-6 h-6 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            </div>
                            <div className="flex-1 min-w-0">
                                <h4 className="text-sm font-bold text-white mb-0.5">{toast.title}</h4>
                                <p className="text-xs text-zinc-400 break-words">{toast.message}</p>
                            </div>
                            <button
                                onClick={() => setToasts(prev => prev.filter(t => t.id !== toast.id))}
                                className="text-zinc-500 hover:text-white transition-colors"
                            >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </motion.div>
                    ))}
                </AnimatePresence>
            </div>

            {/* Clear Data Modal */}
            <AnimatePresence>
                {showClearModal && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-zinc-900 border border-white/10 rounded-2xl p-6 max-w-sm w-full shadow-2xl"
                        >
                            <div className="flex flex-col items-center text-center space-y-4">
                                <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center text-red-500 text-3xl">
                                    🗑️
                                </div>

                                <div>
                                    <h3 className="text-xl font-bold text-white mb-2">
                                        Delete {activeTab === 'all' ? 'All' : activeTab.toUpperCase()} Items?
                                    </h3>
                                    <p className="text-sm text-zinc-400 leading-relaxed">
                                        You are about to delete <strong>{activeTab.toUpperCase()}</strong> activity on this device.
                                        <br /><span className="text-red-400 font-bold">This action cannot be undone.</span>
                                    </p>
                                </div>

                                <div className="flex flex-col gap-3 w-full">
                                    {(activeTab === 'received' || activeTab === 'sent') && (
                                        <button
                                            onClick={handleExportData}
                                            className="w-full py-3 rounded-xl bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 font-bold text-sm border border-blue-500/20 flex items-center justify-center gap-2"
                                        >
                                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                                            Download Receipts (PDF)
                                        </button>
                                    )}

                                    <div className="flex gap-3 w-full">
                                        <button
                                            onClick={() => setShowClearModal(false)}
                                            disabled={isClearing}
                                            className="flex-1 py-3 rounded-xl bg-zinc-800 text-zinc-300 hover:bg-zinc-700 font-bold text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            onClick={handleClearData}
                                            disabled={isClearing}
                                            className="flex-1 py-3 rounded-xl bg-red-500 text-white hover:bg-red-600 font-bold text-sm shadow-lg shadow-red-500/20 disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                        >
                                            {isClearing ? (
                                                <>
                                                    <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                                                    Processing...
                                                </>
                                            ) : (
                                                `Delete ${activeTab === 'all' ? 'All' : activeTab}`
                                            )}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
            </div>
        </section>
    );
}
