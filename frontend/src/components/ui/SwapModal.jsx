import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { arcGasHeadroom, waitForReceipt, toHexValue } from '../../utils/chainUtils';
import { saveTrade } from '../../utils/localStorage';

const SYNTHRA_API = import.meta.env.VITE_SYNTHRA_API_BASE || 'https://trading-api.synthra.org';
const ARC_CHAIN_ID = 5042002;
const API_HEADERS = {
  'Content-Type': 'application/json',
  'X-API-KEY': import.meta.env.VITE_SYNTHRA_API_KEY || ''
};

export default function SwapModal({ isOpen, onClose, tokenIn, tokenOut, amountIn, amountOut, rawAmountIn, userAddress }) {
  const [currentStep, setCurrentStep] = useState(0); // 0: approve, 1: swap, 2: wait, 3: success
  const [status, setStatus] = useState('idle'); // idle, loading, error
  const [errorMsg, setErrorMsg] = useState('');
  const [swapTxHash, setSwapTxHash] = useState('');

  const StepIndicator = ({ stepIndex }) => {
    const isActive = currentStep === stepIndex;
    const isDone = currentStep > stepIndex;
    const isLoading = isActive && status === 'loading';
    if (isDone) return (
      <div className="w-5 h-5 rounded-full bg-[#4A90E2] border-2 border-[#4A90E2] flex items-center justify-center shrink-0">
        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
      </div>
    );
    if (isLoading) return <div className="w-5 h-5 rounded-full border-2 border-[#4A90E2] border-t-transparent animate-spin shrink-0 shadow-[0_0_12px_rgba(74,144,226,0.6)]" />;
    return <div className={`w-5 h-5 rounded-full border-2 shrink-0 transition-all ${isActive ? 'border-[#4A90E2] bg-[#4A90E2]/20 shadow-[0_0_12px_rgba(74,144,226,0.4)]' : 'border-dark-border bg-transparent'}`} />;
  };

  const executeSwapFlow = async () => {
    if (!userAddress || !rawAmountIn) return;
    setCurrentStep(0);
    setStatus('loading');
    setErrorMsg('');

    try {
      // Fetch the swap payload
      const res = await fetch(`${SYNTHRA_API}/v1/swap`, {
        method:  'POST',
        headers: API_HEADERS,
        body: JSON.stringify({
          chainId:      ARC_CHAIN_ID,
          tokenIn:      tokenIn.address,
          tokenOut:     tokenOut.address,
          amount:       rawAmountIn,
          recipient:    userAddress,
          sender:       userAddress,
          approvalMode: 'erc20',
          slippageBps:  50,
        }),
      });
      if (!res.ok) throw new Error(`Failed to build swap: ${res.status}`);
      const swapData = await res.json();

      // STEP 0: APPROVE
      const approveTx = swapData?.approval?.tokenApproval?.approveTransaction;
      if (approveTx) {
        setCurrentStep(0);
        const approveHash = await window.ethereum.request({
          method: 'eth_sendTransaction',
          params: [{ from: userAddress, to: approveTx.to, data: approveTx.data }],
        });
        await waitForReceipt(approveHash);
      }

      // STEP 1: SWAP
      setCurrentStep(1);
      const tx = swapData.transaction;
      if (!tx) throw new Error('API did not return a transaction object');

      const hash = await window.ethereum.request({
        method: 'eth_sendTransaction',
        params: [{
          from:  userAddress,
          to:    tx.to,
          data:  tx.data,
          value: tx.value ? toHexValue(tx.value) : '0x0',
          gas:   arcGasHeadroom(tx.gasLimit),
        }],
      });
      
      setSwapTxHash(hash);

      // STEP 2: WAIT
      setCurrentStep(2);
      await waitForReceipt(hash);
      
      // Extra delay to provide realistic ~2 sec experience
      await new Promise(resolve => setTimeout(resolve, 2000));

      // STEP 3: SUCCESS
      setCurrentStep(4);
      setStatus('idle');
      
      saveTrade({
        type: 'Swap',
        walletAddress: userAddress,
        tokenIn: tokenIn.symbol,
        tokenOut: tokenOut.symbol,
        amountIn,
        amountOut,
        txHash: hash
      });
    } catch (err) {
      console.error('[SwapModal]', err);
      if (err.code === 4001 || err.message?.includes('user rejected')) {
        setErrorMsg('Transaction rejected by user.');
      } else {
        setErrorMsg(err.message || 'Unknown error');
      }
      setStatus('error');
    }
  };

  useEffect(() => {
    if (isOpen) {
      // Inicia automaticamente o fluxo assim que o modal abre
      executeSwapFlow();
    } else {
      // Reseta estado quando fecha
      setCurrentStep(0);
      setStatus('idle');
      setErrorMsg('');
      setSwapTxHash('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 20 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="bg-[#1C1C1E] border border-white/10 rounded-[32px] w-full max-w-[420px] shadow-[0_0_50px_rgba(0,0,0,0.8)] overflow-hidden p-6 relative"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Close Button */}
          <button onClick={onClose} className="absolute top-5 right-5 text-dark-muted hover:text-white transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>

          {/* Tokens Header */}
          <div className="flex flex-col items-center mt-2 mb-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full relative shrink-0">
                 <img src={tokenIn.iconImg} alt={tokenIn.symbol} className="w-full h-full rounded-full object-contain" />
                 <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-black rounded-full p-[2px]">
                   <img src="https://cdn.prod.website-files.com/685311a976e7c248b5dfde95/68926aad995d4eae931403a4_arc-favicon-256x256.png" className="w-full h-full rounded-full" />
                 </div>
              </div>
              <svg className="w-5 h-5 text-dark-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
              <div className="w-12 h-12 rounded-full relative shrink-0">
                 <img src={tokenOut.iconImg} alt={tokenOut.symbol} className="w-full h-full rounded-full object-contain" />
                 <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-black rounded-full p-[2px]">
                   <img src="https://cdn.prod.website-files.com/685311a976e7c248b5dfde95/68926aad995d4eae931403a4_arc-favicon-256x256.png" className="w-full h-full rounded-full" />
                 </div>
              </div>
            </div>
            
            <h2 className="text-[22px] font-bold text-white tracking-tight mb-1 text-center">
              Swap {amountIn} {tokenIn.symbol} to {amountOut} {tokenOut.symbol}
            </h2>
            <span className="text-sm text-dark-muted font-medium">via Synthra</span>
          </div>

          <div className="flex justify-center mb-6">
            <div className="bg-[#2C2C2E] px-4 py-1.5 rounded-full text-[13px] font-semibold text-white/90">
              Steps
            </div>
          </div>

          {/* Timeline Box */}
          <div className="bg-white/[0.02] border border-white/5 shadow-[0_0_20px_rgba(0,0,0,0.3)] backdrop-blur-xl rounded-3xl p-5 relative">
             <div className="absolute left-[29px] top-[38px] bottom-[48px] w-[2px] bg-dark-border/40 z-0" />

             {[
               { label: `Approve ${tokenIn.symbol}`, hint: 'Approving in your wallet' },
               { label: 'Confirm Swap', hint: 'Confirming in wallet' },
               { label: 'Wait ~2 sec', hint: 'Processing on Arc' },
               { label: 'Swap Successful!', hint: '' },
             ].map((step, i) => (
               <div key={i} className={`flex items-center gap-4 relative z-10 ${i < 3 ? 'mb-6' : ''}`}>
                 <StepIndicator stepIndex={i} />
                 <div className="flex-1 flex justify-between items-center">
                   <span className={`font-semibold text-[15px] transition-colors ${currentStep >= i ? (i === 3 ? 'text-green-400 drop-shadow-[0_0_8px_rgba(74,222,128,0.5)]' : 'text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.3)]') : 'text-white/40'}`}>
                     {step.label}
                   </span>
                   {currentStep === i && status === 'loading' && step.hint && (
                     <span className="text-[13px] text-[#4A90E2] drop-shadow-[0_0_5px_rgba(74,144,226,0.5)] animate-pulse">{step.hint}</span>
                   )}
                   {i === 3 && currentStep >= 3 && <span className="text-[13px] text-green-400">✓ Done</span>}
                 </div>
               </div>
             ))}
          </div>

          {swapTxHash && currentStep >= 4 && (
            <div className="mt-4 flex flex-col gap-2 items-center text-xs text-dark-muted bg-dark-bg/50 p-3 rounded-xl border border-dark-border/50">
              <div>
                Tx:{' '}
                <a href={`https://testnet.arcscan.app/tx/${swapTxHash}`} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">
                  {swapTxHash.slice(0, 10)}...{swapTxHash.slice(-8)}
                </a>
              </div>
            </div>
          )}

          {errorMsg && (
            <div className="mt-4 p-3 bg-red-900/30 border border-red-500/50 rounded-xl text-xs text-red-400 text-center">
              {errorMsg}
            </div>
          )}

          {currentStep === 4 && (
            <button onClick={onClose} className="w-full mt-4 bg-[#2C2C2E] hover:bg-[#3C3C3E] text-white py-3 rounded-xl font-bold transition-all">
              Done
            </button>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
