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

  // Helper component for timeline dots
  const StepIndicator = ({ stepIndex }) => {
    const isActive = currentStep === stepIndex;
    const isDone = currentStep > stepIndex;
    const isLoading = isActive && status === 'loading';

    if (isDone) {
      return (
        <div className="w-5 h-5 rounded-full bg-[#4A90E2] border-2 border-[#4A90E2] flex items-center justify-center shrink-0">
           <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
             <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
           </svg>
        </div>
      );
    }
    if (isLoading) {
      return (
        <div className="w-5 h-5 rounded-full border-2 border-[#4A90E2] border-t-transparent animate-spin shrink-0" />
      );
    }
    return (
      <div className={`w-5 h-5 rounded-full border-2 shrink-0 ${isActive ? 'border-[#4A90E2] bg-[#4A90E2]/20' : 'border-dark-border bg-dark-bg'}`} />
    );
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
      if (!res.ok) throw new Error(`Falha ao montar swap: ${res.status}`);
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
      if (!tx) throw new Error('API não retornou transaction object');

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

      // STEP 2: WAIT
      setCurrentStep(2);
      await waitForReceipt(hash);
      
      // Delay extra para dar o "Wait ~2 sec" experience real
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
        hash
      });
    } catch (err) {
      console.error('[SwapModal]', err);
      if (err.code === 4001 || err.message?.includes('user rejected')) {
        setErrorMsg('Transação rejeitada pelo usuário.');
      } else {
        setErrorMsg(err.message || 'Erro desconhecido');
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
          className="bg-[#1C1C1E] border border-dark-border rounded-[32px] w-full max-w-[420px] shadow-2xl overflow-hidden p-6 relative"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Close Button */}
          <button onClick={onClose} className="absolute top-5 right-5 text-dark-muted hover:text-white transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>

          {/* Tokens Header */}
          <div className="flex flex-col items-center mt-2 mb-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full p-[2px] bg-[#2C2C2E] relative shrink-0">
                 <img src={tokenIn.iconImg} alt={tokenIn.symbol} className="w-full h-full rounded-full" />
                 <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-black rounded-full p-[2px]">
                   <img src="https://cdn.prod.website-files.com/685311a976e7c248b5dfde95/68926aad995d4eae931403a4_arc-favicon-256x256.png" className="w-full h-full rounded-full" />
                 </div>
              </div>
              <svg className="w-5 h-5 text-dark-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
              <div className="w-12 h-12 rounded-full p-[2px] bg-[#2C2C2E] relative shrink-0">
                 <img src={tokenOut.iconImg} alt={tokenOut.symbol} className="w-full h-full rounded-full" />
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
          <div className="bg-transparent border border-dark-border/60 rounded-3xl p-5 relative">
             <div className="absolute left-[29px] top-[38px] bottom-[48px] w-[2px] bg-dark-border/40 z-0" />

             {/* Step 0: Approve */}
             <div className="flex items-center gap-4 relative z-10 mb-6">
               <StepIndicator stepIndex={0} />
               <div className="flex-1 flex justify-between items-center">
                 <span className={`font-semibold text-[15px] ${currentStep >= 0 ? 'text-white' : 'text-dark-muted'}`}>Approve {tokenIn.symbol}</span>
                 {currentStep === 0 && status === 'loading' && <span className="text-[13px] text-dark-muted">Approving in your wallet</span>}
               </div>
             </div>

             {/* Step 1: Swap */}
             <div className="flex items-center gap-4 relative z-10 mb-6">
               <StepIndicator stepIndex={1} />
               <div className="flex-1 flex justify-between items-center">
                 <span className={`font-semibold text-[15px] ${currentStep >= 1 ? 'text-white' : 'text-dark-muted'}`}>Confirm Swap</span>
                 {currentStep === 1 && status === 'loading' && <span className="text-[13px] text-[#4A90E2]">Confirming in wallet</span>}
               </div>
             </div>

             {/* Step 2: Wait */}
             <div className="flex items-center gap-4 relative z-10 mb-6">
               <StepIndicator stepIndex={2} />
               <div className="flex-1 flex justify-between items-center">
                 <span className={`font-semibold text-[15px] ${currentStep >= 2 ? 'text-white' : 'text-dark-muted'}`}>Wait ~2 sec</span>
                 {currentStep === 2 && status === 'loading' && <span className="text-[13px] text-[#4A90E2]">Processing on Arc</span>}
               </div>
             </div>

             {/* Step 3: Success */}
             <div className="flex items-center gap-4 relative z-10">
               <StepIndicator stepIndex={3} />
               <div className="flex-1 flex justify-between items-center">
                 <span className={`font-semibold text-[15px] ${currentStep >= 3 ? 'text-white' : 'text-dark-muted'}`}>Got {amountOut} {tokenOut.symbol} on Arc</span>
               </div>
             </div>
          </div>

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
