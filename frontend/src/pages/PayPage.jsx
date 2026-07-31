import { useState, useEffect, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { useAccount, useSwitchChain, useChainId, useReadContract, useConnect } from 'wagmi'
import { getPaymentLinkById, updatePaymentLink, saveSentPayment } from '../utils/localStorage'
import { generatePaymentReceipt } from '../utils/generateReceipt'
import { invoiceAPI } from '../services/invoiceService'
import QRCode from 'react-qr-code'
import WalletModal from '../components/ui/WalletModal'
import { toast } from 'sonner'
import { parseUnits, formatUnits } from 'viem'
import { ERC20_ABI } from '../utils/abis'
import { arcTestnet } from '../config/wagmi'
import { getAppKit, createCircleAdapter } from '../config/circleKit'
import SelfPayModal from '../components/ui/SelfPayModal'

// Official Arc Testnet Addresses
const USDC_ADDRESS = "0x3600000000000000000000000000000000000000";
const EURC_ADDRESS = "0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a";

export default function PayPage() {
    const { linkId } = useParams()
    const { address, isConnected } = useAccount()
    const { connect, connectors } = useConnect()
    const [isWalletModalOpen, setIsWalletModalOpen] = useState(false)
    const [paymentData, setPaymentData] = useState(null)
    const [isLoading, setIsLoading] = useState(true) // Start loading
    const [isPaying, setIsPaying] = useState(false)
    const [paymentComplete, setPaymentComplete] = useState(false)
    const [txHash, setTxHash] = useState('')
    const [confirmedPayer, setConfirmedPayer] = useState(null)
    const [error, setError] = useState('')
    const [timeLeft, setTimeLeft] = useState(null)
    const [isExpired, setIsExpired] = useState(false)
    const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 })
    const [showSelfPayModal, setShowSelfPayModal] = useState(false)

    // Mouse tracking for spotlight effect
    const handleMouseMove = (e) => {
        const rect = e.currentTarget.getBoundingClientRect()
        setMousePosition({
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        })
    }

    // Wagmi Hooks
    const chainId = useChainId()
    const { switchChain } = useSwitchChain()

    // Check token balance
    const tokenAddress = paymentData?.currency === 'EURC' ? EURC_ADDRESS : USDC_ADDRESS;
    const { data: balance } = useReadContract({
        address: tokenAddress,
        abi: ERC20_ABI,
        functionName: 'balanceOf',
        args: [address],
        query: {
            enabled: !!(address && paymentData?.amount && isConnected && chainId === arcTestnet.id)
        }
    })

    // Check if user has sufficient balance
    const requiredAmount = paymentData?.amount ? parseUnits(paymentData.amount.toString(), 6) : 0n;
    const hasInsufficientBalance = balance !== undefined && balance < requiredAmount;

    useEffect(() => {
        const loadPaymentData = async () => {
            try {
                // 1. Try to get from localStorage (Creator view)
                const savedLink = getPaymentLinkById(linkId)
                let data = null;

                if (savedLink) {
                    // Normalize localStorage data to match component expectations
                    data = {
                        ...savedLink,
                        recipientWallet: savedLink.wallet || savedLink.recipientWallet,
                        recipientName: savedLink.name || savedLink.recipientName
                    };
                } else {
                    // 2. Try to get from Backend (Payer view)
                    const invoice = await invoiceAPI.getById(linkId);
                    if (invoice) {
                        data = invoice;
                    } else {
                        setError('Invalid or expired payment link.');
                    }
                }

                if (data) {
                    setPaymentData(data);

                    // Expiration Logic
                    if (data.status !== 'paid') {
                        const created = new Date(Number(data.createdAt)).getTime();
                        const now = Date.now();
                        const expiry = created + (24 * 60 * 60 * 1000); // 24h Production expiration
                        const diff = expiry - now;

                        if (diff <= 0) {
                            setIsExpired(true);
                        } else {
                            setTimeLeft(diff);
                        }
                    }
                }
            } catch (err) {
                console.error('Critical Error loading payment:', err);
                setError('Failed to load payment info.');
            } finally {
                setIsLoading(false); // Stop loading ALWAYS
            }
        };

        if (linkId) {
            loadPaymentData();
        }
    }, [linkId])

    // POLLING: Check for status updates every 3s (Syncs Payer <-> Creator)
    useEffect(() => {
        if (!linkId || paymentData?.status === 'paid' || paymentComplete) return;

        const pollStatus = async () => {
            try {
                // Check local storage first (faster for Creator)
                const localLink = getPaymentLinkById(linkId);
                if (localLink?.status === 'paid') {
                    setPaymentData(prev => ({ ...prev, ...localLink }));
                    return;
                }

                // Check API (for Payer)
                const invoice = await invoiceAPI.getById(linkId);

                if (invoice) {
                    // Self-Healing: If we have data now but had an error/no-data before, fix it
                    if (!paymentData || error) {
                        setPaymentData(invoice);
                        setError(''); // Clear error if found
                        setIsLoading(false);
                    }

                    // Sync Paid Status
                    if (invoice.status === 'paid' && paymentData?.status !== 'paid') {
                        setPaymentData(prev => ({
                            ...prev,
                            ...invoice, // Spread all new data
                            status: 'paid'
                        }));
                    }
                }
            } catch (err) {
                // Silent catch for polling
            }
        };

        // 1. Polling (Cross-device/server sync) - 0.5s (Aggressive)
        const interval = setInterval(pollStatus, 500);

        // 2. Storage Event (Instant same-browser sync)
        const handleStorageChange = (e) => {
            if (e.key === 'payment_links') {
                pollStatus(); // Force check immediately
            }
        };
        window.addEventListener('storage', handleStorageChange);

        return () => {
            clearInterval(interval);
            window.removeEventListener('storage', handleStorageChange);
        };
    }, [linkId, paymentData?.status, paymentComplete]);

    // Timer Effect
    useEffect(() => {
        if (!timeLeft || isExpired || paymentData?.status === 'paid') return;

        const interval = setInterval(() => {
            setTimeLeft(prev => {
                if (prev <= 1000) {
                    clearInterval(interval);
                    setIsExpired(true);
                    return 0;
                }
                return prev - 1000;
            });
        }, 1000);

        return () => clearInterval(interval);
    }, [timeLeft, isExpired, paymentData]);

    const formatTime = (ms) => {
        const seconds = Math.floor((ms / 1000) % 60);
        const minutes = Math.floor((ms / (1000 * 60)) % 60);
        const hours = Math.floor((ms / (1000 * 60 * 60)));
        return `${hours}h ${minutes}m ${seconds}s`;
    };

    // Monitor Transaction via AppKit result (no longer via wagmi hash)
    // handlePaymentSuccess is called directly inside kit.send()

    const handlePayment = async () => {
        if (!paymentData) return

        if (!isConnected) {
            setIsWalletModalOpen(true)
            return
        }

        if (chainId !== arcTestnet.id) {
            try {
                toast.info('Switching to Arc Testnet...')
                await switchChain({ chainId: arcTestnet.id })
            } catch (err) {
                toast.error('You need to be on Arc Testnet to pay')
                return
            }
        }

        setIsPaying(true)

        try {
            const kit = getAppKit()
            // createCircleAdapter is async (official documentation)
            const adapter = await createCircleAdapter()
            const result = await kit.send({
                from: { adapter, chain: 'Arc_Testnet' },
                to: paymentData.recipientWallet,
                amount: paymentData.amount.toString(),
                token: paymentData.currency || 'USDC',
            })
            const confirmedHash = result?.txHash || result?.hash || ''
            await handlePaymentSuccess(confirmedHash, address)
        } catch (err) {
            console.error('[AppKit] kit.send() error:', err)
            setIsPaying(false)
            const msg = (err.message || '').toLowerCase()
            const code = String(err.code || err.name || '').toLowerCase()

            if (msg.includes('rejected') || msg.includes('denied') || msg.includes('cancel') || msg.includes('user rejected')) {
                toast.info('Transaction cancelled')
            } else if (msg.includes('different address than the sender') || msg.includes('invalid_address') || code.includes('invalid_address')) {
                setShowSelfPayModal(true)
            } else if (msg.includes('insufficient') || msg.includes('balance')) {
                toast.error('💰 Insufficient USDC balance')
            } else {
                toast.error('Payment Error: ' + (err.message || 'Please try again'))
            }
        }
    }

    const handlePaymentSuccess = async (confirmedHash, payerAddress) => {
        setTxHash(confirmedHash)
        setConfirmedPayer(payerAddress)
        // console.log('✅ Payment Success. Hash:', confirmedHash, 'Payer:', payerAddress);

        // Update localStorage if link exists (for receiver)
        if (paymentData?.id) {
            updatePaymentLink(paymentData.id, {
                status: 'paid',
                txHash: confirmedHash,
                paidAt: Date.now(),
                payer: payerAddress
            })
        }

        // Update backend
        try {
            await invoiceAPI.updateStatus(linkId, 'paid', {
                txHash: confirmedHash,
                paidAt: Date.now(),
                payer: payerAddress
            })
        } catch (err) {
            console.error('Failed to sync payment status:', err)
        }

        // Save sent payment
        saveSentPayment({
            id: paymentData?.id || linkId,
            recipientName: paymentData.recipientName,
            recipientWallet: paymentData.recipientWallet,
            amount: paymentData.amount,
            currency: paymentData.currency,
            description: paymentData.description,
            txHash: confirmedHash,
            payer: address
        })

        setIsPaying(false)
        setPaymentComplete(true)
        toast.success('Payment processed successfully!')
    }

    // ERROR STATE UI
    if (error) {
        return (
            <div className="flex-1 flex items-center justify-center p-4 h-full min-h-0 w-full">
                <div className="relative group max-w-sm w-full">
                    {/* Background Glow */}
                    <div className="absolute inset-0 bg-gradient-to-br from-red-500/20 to-orange-500/20 rounded-2xl blur-xl opacity-75 group-hover:opacity-100 transition-opacity animate-pulse"></div>

                    {/* Card Content */}
                    <div className="relative bg-slate-900/90 backdrop-blur-xl border border-red-500/30 p-8 rounded-2xl text-center space-y-6 shadow-2xl">

                        {/* Essential Info - Highlighted */}
                        <div className="space-y-4">
                            <div className="relative w-16 h-16 mx-auto bg-red-500/10 rounded-full flex items-center justify-center border border-red-500/20">
                                <span className="text-3xl text-red-500">⚠️</span>
                            </div>

                            <h2 className="text-2xl font-black text-white tracking-tight">
                                Link Unavailable
                            </h2>

                            <div className="p-4 rounded-xl bg-red-500/5 border border-red-500/10">
                                <p className="text-red-200 text-sm font-medium">
                                    {error}
                                </p>
                                <p className="text-[10px] text-red-500/50 font-mono mt-2">
                                    ID: {linkId}
                                </p>
                            </div>
                        </div>

                        {/* Guidance - Secondary */}
                        <div className="space-y-4 pt-4 border-t border-white/5">
                            <p className="text-gray-200 text-sm font-medium">
                                What to do now?
                            </p>
                            <p className="text-gray-300 text-xs px-2 leading-relaxed">
                                Request a new link from whoever sent you this invoice.
                            </p>
                        </div>

                        {/* Intelligent Action - Navigate Home */}
                        <a
                            href="/"
                            className="block w-full px-6 py-3.5 rounded-xl font-bold text-sm bg-white/5 hover:bg-white/10 text-white border border-white/10 transition-all flex items-center justify-center gap-2"
                        >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                            </svg>
                            Back to Home
                        </a>
                    </div>
                </div>
            </div>
        )
    }

    // SAFETY CHECK - LOADING STATE
    if (isLoading) {
        return (
            <div className="flex-1 flex items-center justify-center h-full min-h-0 w-full">
                <div className="text-center">
                    <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-gray-400">Verifying status...</p>
                </div>
            </div>
        )
    }

    // SAFETY CHECK - MISSING DATA (Stop-gap for Zombie/Corrupted links)
    // If we are NOT loading, and have NO Error (handled above), but also NO Data
    if (!paymentData || !paymentData.recipientWallet) {
        return (
            <div className="flex-1 flex items-center justify-center p-4 h-full min-h-0 w-full">
                <div className="max-w-md w-full bg-red-500/10 border border-red-500/20 rounded-2xl p-8 text-center space-y-4">
                    <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto text-red-500 text-3xl">
                        ?
                    </div>
                    <h2 className="text-xl font-bold text-white">Payment Data Not Found</h2>
                    <p className="text-gray-400 text-sm">
                        The link failed to load and no error was returned. This implies the link might not exist.
                    </p>
                    <a href="/" className="inline-block mt-4 px-6 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold transition-all">
                        Back to Home
                    </a>
                </div>
            </div>
        )
    }

    // SUCCESS STATE (Unified for both Instant & Already Paid)
    if (paymentComplete || paymentData.status === 'paid') {
        const handleDownloadReceipt = () => {
            generatePaymentReceipt({
                ...paymentData,
                status: 'paid',
                // Prioritize State > PaymentData > Fallback
                txHash: txHash || paymentData.txHash,
                paidAt: paymentData.paidAt || Date.now(),
                payer: confirmedPayer || paymentData.payer || 'Anonymous',
                // Ensure recipient wallet is consistent
                recipientWallet: paymentData.recipientWallet || paymentData.walletAddress
            })
            toast.success('Receipt downloaded successfully!')
        }
        const displayHash = txHash || paymentData.txHash;

        return (
            <section className="flex-1 flex items-center justify-center p-4 pb-8 h-full min-h-0">

                <div className="max-w-md w-full">
                    <div className="relative group">
                        <div className="absolute inset-0 bg-green-500/20 rounded-2xl blur-2xl"></div>
                        <div className="relative bg-gradient-to-br from-white/[0.07] to-white/[0.02] backdrop-blur-xl border border-white/10 rounded-2xl p-6 text-center space-y-4">
                            <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto">
                                <span className="text-4xl">✓</span>
                            </div>

                            <div>
                                <h1 className="text-2xl font-black mb-1">Payment Confirmed!</h1>
                                <p className="text-sm text-gray-400">Transaction processed successfully</p>
                            </div>

                            <div className="p-3 rounded-xl bg-white/[0.02] border border-white/10 space-y-1.5 text-xs">
                                <div className="flex justify-between">
                                    <span className="text-gray-400">Amount:</span>
                                    <span className="font-bold">{paymentData.amount} {paymentData.currency}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-400">To:</span>
                                    <span className="font-bold">{paymentData.recipientName}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-400">Status:</span>
                                    <span className="text-green-400 font-bold">Confirmed</span>
                                </div>
                            </div>

                            {displayHash && (
                                <div className="p-3 rounded-xl bg-white/[0.02] border border-white/10">
                                    <p className="text-xs text-gray-400 mb-1">Transaction Hash:</p>
                                    <a
                                        href={`https://testnet.arcscan.app/tx/${displayHash}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-xs font-mono text-blue-400 hover:text-blue-300 break-all transition-colors flex items-center justify-center gap-1"
                                    >
                                        {displayHash.slice(0, 10)}...{displayHash.slice(-10)}
                                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                                    </a>
                                </div>
                            )}

                            <button
                                onClick={handleDownloadReceipt}
                                className="w-full py-3.5 rounded-xl font-bold bg-blue-500 hover:bg-blue-600 text-white transition-all shadow-lg shadow-blue-500/25 flex items-center justify-center gap-2"
                            >
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                                Download PDF Receipt
                            </button>

                            <div className="pt-2 text-[10px] text-gray-500 font-mono">
                                Link ID: {linkId}
                            </div>
                        </div>

                        <div className="mt-8 text-center w-full relative z-10">
                            <a
                                href="/"
                                className="flex items-center justify-center gap-2 px-6 py-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-sm font-bold text-zinc-300 hover:text-white transition-all hover:scale-105 active:scale-95 group w-full cursor-pointer shadow-lg"
                            >
                                <svg className="w-4 h-4 group-hover:-translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                                Back to Home
                            </a>
                        </div>
                    </div>
                </div>
            </section>
        )
    }

    // EXPIRED STATE (Only show if NOT paid)
    if (isExpired && paymentData.status !== 'paid') {

        return (
            <section className="flex-1 flex items-center justify-center p-4 pb-8 h-full min-h-0">
                <div className="max-w-md w-full opacity-0 animate-[fadeIn_0.5s_ease-out_forwards]">
                    <div className="relative group perspective-[1000px]">

                        {/* Broken Card Container - Restored Effect */}
                        <div className="relative flex flex-col gap-4 max-w-md w-full mx-auto">

                            {/* TOP HALF - BROKEN */}
                            <div className="relative bg-[#0F1115] border border-white/10 rounded-t-3xl p-8 pb-12 text-center shadow-2xl overflow-hidden"
                                style={{ clipPath: 'polygon(0% 0%, 100% 0%, 100% 100%, 85% 90%, 70% 100%, 55% 90%, 40% 100%, 25% 90%, 10% 100%, 0% 90%)' }}>
                                <div className="space-y-4">
                                    {/* Icon - Red Exclamation instead of Hourglass */}
                                    <div className="w-20 h-20 bg-red-500/10 rounded-2xl flex items-center justify-center mx-auto shadow-inner border border-red-500/20">
                                        <svg className="w-10 h-10 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                        </svg>
                                    </div>
                                    <div>
                                        <h1 className="text-3xl font-black text-white mb-2 tracking-tight">Link Expired</h1>
                                        <p className="text-gray-400 text-sm font-medium">This payment link is no longer valid.</p>
                                    </div>
                                </div>
                            </div>

                            {/* BOTTOM HALF - BROKEN (Rotated slightly for effect) */}
                            <div className="relative bg-[#0F1115] border border-white/10 rounded-b-3xl p-8 pt-12 text-center shadow-2xl mt-[-30px] origin-top-left rotate-[-2deg] opacity-75 grayscale transition-all hover:rotate-0 hover:opacity-100 hover:grayscale-0"
                                style={{ clipPath: 'polygon(0% 10%, 10% 0%, 25% 10%, 40% 0%, 55% 10%, 70% 0%, 85% 10%, 100% 0%, 100% 100%, 0% 100%)' }}>

                                <div className="space-y-6">
                                    <div className="bg-white/[0.02] rounded-xl p-4 border border-white/5">
                                        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Amount Was</p>
                                        <p className="text-2xl font-bold text-gray-500 line-through decoration-red-500/50">
                                            {paymentData.amount} {paymentData.currency}
                                        </p>
                                    </div>

                                    <div className="text-sm text-gray-400 bg-red-500/5 border border-red-500/10 p-4 rounded-xl leading-relaxed">
                                        <strong className="text-red-400 block mb-1">Action Required</strong>
                                        Please contact the person who sent you this link to request a new invoice.
                                    </div>
                                </div>
                            </div>

                        </div>

                        {/* Back to Home - Prominent */}
                        <div className="mt-8 max-w-md w-full mx-auto">
                            <a
                                href="/"
                                className="flex items-center justify-center gap-2 px-6 py-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-sm font-bold text-zinc-300 hover:text-white transition-all hover:scale-105 active:scale-95 group w-full cursor-pointer shadow-lg"
                            >
                                <svg className="w-5 h-5 transition-transform group-hover:-translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                                </svg>
                                Back to Home
                            </a>
                        </div>
                    </div>
                </div>
            </section>
        )
    }

    // MAIN FORM STATE
    return (
        <section className="flex-1 flex flex-col items-center justify-start py-4 w-full h-full min-h-0 overflow-y-auto">
            <div className="max-w-4xl w-full">
                <div className="relative group" onMouseMove={handleMouseMove}>
                    {/* Spotlight Effect - Follows cursor */}
                    <div
                        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none rounded-2xl overflow-hidden"
                        style={{
                            background: `radial-gradient(600px circle at ${mousePosition.x}px ${mousePosition.y}px, rgba(59, 130, 246, 0.05), transparent 40%)`
                        }}
                    />

                    <div className="relative bg-gradient-to-br from-white/[0.07] to-white/[0.02] backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-2xl">
                        {/* Header */}
                        <div className="text-center space-y-1 mb-4">
                            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-semibold">
                                <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse"></span>
                                Aura Payments
                            </div>
                            <h1 className="text-3xl font-black mt-2">Payment Request</h1>

                            {timeLeft !== null && (
                                <div className="flex items-center justify-center gap-2 mt-2 bg-amber-500/10 border border-amber-500/20 rounded-lg py-2 px-4 w-fit mx-auto animate-pulse">
                                    <svg className="w-4 h-4 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                    <span className="text-base font-bold text-amber-500 font-mono tracking-wide">
                                        {formatTime(timeLeft)}
                                    </span>
                                </div>
                            )}
                        </div>

                        {/* Recipient Name Highlight */}
                        <div className="mb-6 p-4 rounded-xl bg-gradient-to-r from-blue-500/10 to-cyan-500/10 border border-blue-500/20">
                            <p className="text-xs text-gray-400 mb-1 text-center">Requested by</p>
                            <p className="text-lg font-bold text-white text-center">{paymentData.recipientName}</p>
                        </div>

                        {/* Two Column Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Left Column - Payment Details */}
                            <div className="space-y-4">
                                {/* Amount */}
                                <div className="p-4 rounded-xl bg-white/[0.02] border border-white/10 text-center">
                                    <p className="text-xs text-gray-400 mb-0.5">Amount to pay</p>
                                    <div className="text-4xl font-black text-emerald-500">
                                        {paymentData.currency === 'EURC' ? '€' : '$'}{paymentData.amount}
                                    </div>
                                    <p className="text-xs text-gray-500 mt-0.5">{paymentData.currency}</p>
                                </div>

                                {/* Description */}
                                {paymentData.description && (
                                    <div className="p-3 rounded-xl bg-white/[0.02] border border-white/10">
                                        <p className="text-xs text-gray-400 mb-0.5">Description</p>
                                        <p className="text-xs text-white">{paymentData.description}</p>
                                    </div>
                                )}

                                {/* Details */}
                                <div className="space-y-1.5 text-xs">
                                    <div className="flex justify-between p-2 rounded-lg bg-white/[0.02]">
                                        <span className="text-gray-400">Recipient</span>
                                        <span className="font-mono text-gray-300">
                                            {paymentData.recipientWallet.slice(0, 6)}...{paymentData.recipientWallet.slice(-4)}
                                        </span>
                                    </div>
                                </div>

                                {/* Network Status & Action Area */}
                                {isConnected && chainId && chainId !== arcTestnet.id ? (
                                    <div className="space-y-3">
                                        {/* Compact Error Message */}
                                        <div className="flex items-center justify-center gap-2 text-amber-500 bg-amber-500/10 py-2 px-3 rounded-lg border border-amber-500/20">
                                            <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                            </svg>
                                            <span className="text-xs font-medium">Wrong Network</span>
                                        </div>

                                        {/* Switch Network Button */}
                                        <button
                                            onClick={() => {
                                                toast.info('Switching to Arc Testnet...')
                                                switchChain({ chainId: arcTestnet.id }).catch(err => {
                                                    console.error('Error switching network:', err)
                                                    toast.error('Error switching network')
                                                })
                                            }}
                                            className="w-full px-6 py-3 rounded-xl font-bold text-base bg-red-500 hover:bg-red-600 text-white transition-all shadow-lg shadow-red-500/20 flex items-center justify-center gap-4 group overflow-hidden relative"
                                        >
                                            {/* Left Arrow - Points Right (Inwards) */}
                                            <svg className="w-5 h-5 animate-bounce-right" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                                            </svg>

                                            <span className="relative z-10 uppercase tracking-wide">Switch to Arc Testnet</span>

                                            {/* Right Arrow - Points Left (Inwards) */}
                                            <svg className="w-5 h-5 animate-bounce-left" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7l5 5m0 0l-5 5m5-5H6" transform="scale(-1, 1) translate(-24, 0)" />
                                            </svg>
                                        </button>
                                    </div>
                                ) : !isConnected ? (
                                    <div className="text-center p-4 rounded-xl bg-white/[0.02] border border-white/10">
                                        <button
                                            onClick={() => setIsWalletModalOpen(true)}
                                            className="w-full py-4 rounded-2xl transition-all active:scale-[0.98] bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.05] text-white font-bold text-lg flex items-center justify-center"
                                        >
                                            Connect Wallet to Pay
                                        </button>
                                        <p className="text-xs text-gray-500 mt-3">
                                            You need to connect a wallet to approve the transaction
                                        </p>
                                    </div>
                                ) : (
                                    <>
                                        <button
                                            onClick={handlePayment}
                                            disabled={isPaying || hasInsufficientBalance}
                                            className={`w-full px-6 py-3 rounded-xl font-bold text-base transition-all shadow-lg disabled:cursor-not-allowed disabled:hover:scale-100 ${hasInsufficientBalance
                                                ? 'bg-gradient-to-r from-red-500 to-orange-500 text-white shadow-red-500/50'
                                                : 'bg-gradient-to-r from-green-500 to-emerald-500 text-white hover:scale-[1.02] active:scale-[0.98] shadow-green-500/50 disabled:opacity-50'
                                                }`}
                                        >
                                            {hasInsufficientBalance ? (
                                                <span className="flex items-center justify-center gap-2">
                                                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                                        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                                    </svg>
                                                    Insufficient Balance
                                                </span>
                                            ) : isPaying ? (
                                                <span className="flex items-center justify-center gap-2">
                                                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                                    </svg>
                                                    Processing...
                                                </span>
                                            ) : (
                                                `Pay ${paymentData.amount} ${paymentData.currency}`
                                            )}
                                        </button>

                                        {/* Insufficient Balance Info Card */}
                                        {hasInsufficientBalance && balance !== undefined && (
                                            <div className="mt-4 p-4 rounded-xl bg-white/[0.03] border border-red-500/20 backdrop-blur-sm">
                                                <div className="flex items-center justify-between gap-3">
                                                    <div className="flex items-start gap-3">
                                                        <div className="w-10 h-10 rounded-lg bg-red-500/10 flex items-center justify-center flex-shrink-0">
                                                            <svg className="w-5 h-5 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                                                                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                                            </svg>
                                                        </div>
                                                        <div className="flex-1">
                                                            <p className="text-sm text-white font-medium mb-0.5">
                                                                You need {Number(formatUnits(requiredAmount - balance, 6)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} more {paymentData.currency}
                                                            </p>
                                                            <p className="text-xs text-gray-400">
                                                                to complete this payment
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <a
                                                        href="/faucet"
                                                        className="px-4 py-2 rounded-lg bg-blue-500/10 border border-blue-500/30 text-blue-400 text-sm font-semibold hover:bg-blue-500/20 transition-all flex items-center gap-2 whitespace-nowrap"
                                                    >
                                                        Get testnet tokens
                                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                                                        </svg>
                                                    </a>
                                                </div>
                                            </div>
                                        )}
                                    </>
                                )}

                                {/* Info */}
                                <div className="flex items-center justify-center gap-2 text-xs text-gray-500">
                                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                                    </svg>
                                    Secure payment via Arc Network
                                </div>
                            </div>

                            {/* Right Column - QR Code */}
                            <div className="flex flex-col items-center justify-center p-6 rounded-xl bg-white/[0.05] border border-white/10">


                                <div className="bg-white p-3 rounded-lg mb-3">
                                    <QRCode value={window.location.href} size={220} />
                                </div>
                                <p className="text-xs text-gray-400 text-center">
                                    Scan to pay on mobile
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <WalletModal
                isOpen={isWalletModalOpen}
                onClose={() => setIsWalletModalOpen(false)}
                connectors={connectors}
                onSelectWallet={(connector) => {
                    connect({ connector })
                    setIsWalletModalOpen(false)
                }}
            />
            <SelfPayModal
                isOpen={showSelfPayModal}
                onClose={() => setShowSelfPayModal(false)}
                walletAddress={address}
            />
        </section>
    )
}
