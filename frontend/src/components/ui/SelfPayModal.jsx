import { useEffect } from 'react'

export default function SelfPayModal({ isOpen, onClose, walletAddress }) {
    // Fecha com ESC
    useEffect(() => {
        const handler = (e) => { if (e.key === 'Escape') onClose() }
        if (isOpen) window.addEventListener('keydown', handler)
        return () => window.removeEventListener('keydown', handler)
    }, [isOpen, onClose])

    if (!isOpen) return null

    const shortAddr = walletAddress
        ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`
        : ''

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            onClick={onClose}
        >
            {/* Backdrop blur */}
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

            {/* Modal */}
            <div
                className="relative w-full max-w-md animate-modal-in"
                onClick={(e) => e.stopPropagation()}
                style={{ animation: 'modalIn 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)' }}
            >
                {/* Glow de fundo */}
                <div className="absolute -inset-1 bg-gradient-to-r from-amber-500/20 via-orange-500/20 to-red-500/20 rounded-3xl blur-xl opacity-70" />

                <div className="relative bg-gradient-to-br from-[#1a1a2e]/95 via-[#16213e]/95 to-[#0f3460]/95 backdrop-blur-xl border border-amber-500/20 rounded-2xl shadow-2xl overflow-hidden">

                    {/* Linha decorativa topo */}
                    <div className="h-0.5 w-full bg-gradient-to-r from-amber-500 via-orange-400 to-red-500" />

                    <div className="p-6">
                        {/* Ícone central */}
                        <div className="flex flex-col items-center text-center mb-6">
                            <div className="relative mb-4">
                                {/* Anel pulsante */}
                                <div className="absolute inset-0 rounded-full bg-amber-500/20 animate-ping scale-110" />
                                <div className="relative w-16 h-16 rounded-full bg-gradient-to-br from-amber-500/20 to-orange-500/10 border border-amber-500/30 flex items-center justify-center">
                                    <svg className="w-8 h-8 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                                            d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                                    </svg>
                                </div>
                            </div>

                            <h2 className="text-xl font-black text-white mb-1">Invalid Payment</h2>
                            <p className="text-sm text-gray-400">You cannot pay to yourself</p>
                        </div>

                        {/* Explicação */}
                        <div className="bg-white/[0.03] border border-white/10 rounded-xl p-4 mb-4 space-y-3">
                            <div className="flex items-start gap-3">
                                <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                                    <svg className="w-4 h-4 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                </div>
                                <div>
                                    <p className="text-xs text-gray-300 leading-relaxed">
                                        Your connected wallet is <strong className="text-amber-400 font-mono">{shortAddr}</strong> — the same address that <strong className="text-white">created this payment link</strong>.
                                    </p>
                                </div>
                            </div>

                            <div className="h-px bg-white/5" />

                            <div className="flex items-start gap-3">
                                <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                                    <svg className="w-4 h-4 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                </div>
                                <div>
                                    <p className="text-xs text-gray-300 leading-relaxed">
                                        To continue: connect a <strong className="text-blue-400">different wallet</strong> and access this link again to complete the payment.
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Fluxo visual */}
                        <div className="flex items-center justify-center gap-2 mb-5 p-3 rounded-xl bg-white/[0.02] border border-white/5">
                            <div className="flex flex-col items-center">
                                <div className="w-8 h-8 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center">
                                    <svg className="w-4 h-4 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                    </svg>
                                </div>
                                <span className="text-[9px] text-red-400 mt-1 font-mono">{shortAddr}</span>
                                <span className="text-[9px] text-gray-500">Payer</span>
                            </div>

                            <div className="flex-1 flex items-center justify-center">
                                <div className="flex items-center gap-1 text-red-500">
                                    <div className="h-px flex-1 bg-red-500/30 w-8" />
                                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                                    </svg>
                                    <div className="h-px flex-1 bg-red-500/30 w-8" />
                                </div>
                            </div>

                            <div className="flex flex-col items-center">
                                <div className="w-8 h-8 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center">
                                    <svg className="w-4 h-4 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                    </svg>
                                </div>
                                <span className="text-[9px] text-red-400 mt-1 font-mono">{shortAddr}</span>
                                <span className="text-[9px] text-gray-500">Recipient</span>
                            </div>
                        </div>

                        {/* Botão */}
                        <button
                            onClick={onClose}
                            className="w-full py-3 rounded-xl font-bold text-sm bg-gradient-to-r from-amber-500 to-orange-500 text-white hover:from-amber-400 hover:to-orange-400 transition-all shadow-lg shadow-amber-500/20 hover:scale-[1.02] active:scale-[0.98]"
                        >
                            Got it
                        </button>

                        <p className="text-center text-xs text-gray-500 mt-3">
                            Use another wallet to pay this link
                        </p>
                    </div>
                </div>
            </div>

            <style>{`
                @keyframes modalIn {
                    from { opacity: 0; transform: scale(0.85) translateY(20px); }
                    to   { opacity: 1; transform: scale(1) translateY(0); }
                }
            `}</style>
        </div>
    )
}
