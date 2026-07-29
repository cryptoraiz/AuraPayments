import { useState, useEffect } from 'react';
import { useAccount, useConnect } from 'wagmi';
import { getTradeHistoryByWallet } from '../utils/localStorage';
import WalletModal from '../components/ui/WalletModal';
import { motion } from 'framer-motion';

export default function HistoryPage() {
    const { address, isConnected } = useAccount();
    const { connect, connectors } = useConnect();
    const [showWalletModal, setShowWalletModal] = useState(false);
    const [trades, setTrades] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    const handleWalletSelect = (connector) => {
        connect({ connector });
        setShowWalletModal(false);
    };

    useEffect(() => {
        setIsLoading(true);
        if (isConnected && address) {
            const history = getTradeHistoryByWallet(address);
            // Sort by newest first
            history.sort((a, b) => b.createdAt - a.createdAt);
            setTrades(history);
        } else {
            setTrades([]);
        }
        
        // Simular um loading bem rapido para ficar elegante
        setTimeout(() => setIsLoading(false), 800);
    }, [address, isConnected]);

    const HistorySkeleton = () => (
        <div className="group relative bg-white/[0.02] border border-white/5 rounded-xl p-4 animate-pulse">
            <div className="flex items-center justify-between gap-4">
                <div className="w-10 h-10 rounded-xl bg-white/10 shrink-0"></div>
                <div className="flex-1 min-w-0 space-y-2">
                    <div className="h-4 bg-white/10 rounded w-1/3"></div>
                    <div className="h-3 bg-white/5 rounded w-1/4"></div>
                </div>
            </div>
        </div>
    );

    if (!isConnected) return (
        <>
            <section className="flex-1 flex flex-col items-center justify-center p-8 min-h-0 w-full relative overflow-hidden">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-blue-500/10 rounded-full blur-[100px] pointer-events-none"></div>

                <div className="relative w-full max-w-md">
                    <div className="relative bg-white/[0.02] backdrop-blur-xl border border-white/10 rounded-3xl p-8 md:p-10 text-center shadow-2xl overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-blue-500/50 to-transparent"></div>
                        <div className="relative mb-8 mx-auto w-24 h-24">
                            <div className="absolute inset-0 bg-blue-500/20 rounded-full blur-xl animate-pulse"></div>
                            <div className="relative w-full h-full bg-gradient-to-br from-blue-500/10 to-purple-500/10 rounded-full border border-white/10 flex items-center justify-center p-5">
                                <svg className="w-10 h-10 text-blue-400 drop-shadow-[0_0_10px_rgba(96,165,250,0.5)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                </svg>
                            </div>
                        </div>

                        <h2 className="text-2xl md:text-3xl font-bold text-white mb-3 tracking-tight">
                            Connect your wallet
                        </h2>
                        <p className="text-gray-400 text-base leading-relaxed mb-8">
                            Connect your wallet to securely access your Swap and Bridge transaction activity.
                        </p>

                        <button
                            onClick={() => setShowWalletModal(true)}
                            className="w-full mt-2 py-4 rounded-2xl transition-all active:scale-[0.98] bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.05] text-white font-bold text-lg"
                        >
                            Connect Wallet
                        </button>
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
        <section className="flex-1 flex flex-col p-4 md:p-6 min-h-0 w-full items-center">
            <div className="w-full max-w-3xl flex flex-col flex-1 min-h-0 space-y-6">

                {/* Header Container */}
                <div className="flex flex-col gap-2 opacity-0 animate-[fadeIn_0.5s_ease-out_forwards]">
                    <h1 className="text-3xl font-bold text-white">Trade History</h1>
                    <p className="text-zinc-400">Your recent Swap and Bridge activities on Arc</p>
                </div>

                {/* Links List */}
                <div className="flex-1 space-y-3 pb-8 mt-4">
                    {isLoading ? (
                        <div className="grid gap-3">
                            {[1, 2, 3].map((i) => (
                                <HistorySkeleton key={i} />
                            ))}
                        </div>
                    ) : trades.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 text-zinc-600 space-y-4">
                            <div className="w-16 h-16 rounded-full bg-zinc-900 flex items-center justify-center">
                                <svg className="w-6 h-6 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                                </svg>
                            </div>
                            <p className="text-sm font-medium">No swap or bridge activity found.</p>
                        </div>
                    ) : (
                        <div className="grid gap-3">
                            {trades.map(item => (
                                <div key={item.id} className="group relative bg-gradient-to-br from-white/[0.07] to-white/[0.02] backdrop-blur-xl border border-white/10 rounded-xl p-4 transition-all hover:bg-white/[0.04]">
                                    <div className="flex items-center justify-between gap-4">
                                        
                                        {/* Left Icon */}
                                        <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 border ${
                                            item.type === 'Swap' 
                                                ? 'bg-blue-500/10 border-blue-500/20 text-blue-500' 
                                                : 'bg-purple-500/10 border-purple-500/20 text-purple-500'
                                        }`}>
                                            {item.type === 'Swap' ? (
                                                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                                                </svg>
                                            ) : (
                                                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                                                </svg>
                                            )}
                                        </div>

                                        {/* Main Content */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-3 mb-1">
                                                <h3 className="text-base font-bold text-white truncate">
                                                    {item.type === 'Swap' 
                                                        ? `Swap ${item.tokenIn} to ${item.tokenOut}`
                                                        : `Bridge ${item.tokenIn}`
                                                    }
                                                </h3>
                                            </div>

                                            <div className="flex flex-col gap-1 mb-2">
                                                <p className="text-zinc-400 text-sm font-medium">
                                                    {item.type === 'Swap' 
                                                        ? `${item.amountIn} ${item.tokenIn} → ${item.amountOut} ${item.tokenOut}`
                                                        : `${item.amountIn} ${item.tokenIn} (${item.fromChain} → ${item.toChain})`
                                                    }
                                                </p>
                                                <p className="text-zinc-500 text-xs">
                                                    {new Date(Number(item.createdAt)).toLocaleDateString('en-US', {
                                                        day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
                                                    })}
                                                </p>
                                            </div>
                                            
                                            {item.hash && (
                                                <a
                                                    href={`https://testnet.arcscan.app/tx/${item.hash}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white transition-colors text-xs font-bold w-max"
                                                >
                                                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                                                    View Tx
                                                </a>
                                            )}
                                        </div>

                                        {/* Right Side: Status */}
                                        <div className="text-right pl-4">
                                            <span className="text-xs font-bold px-2 py-1.5 rounded-lg inline-block bg-green-500/10 text-green-400 border border-green-500/20">
                                                Completed
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </section>
    );
}
