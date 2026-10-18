import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useChainId } from 'wagmi';
import { arcMainnet, arcTestnet } from '../../config/wagmi';
import { arcGasHeadroom, waitForReceipt, toHexValue } from '../../utils/chainUtils';
import { saveTrade } from '../../utils/localStorage';
import {
  getUniswapAllowance,
  buildUniswapApproveTx,
  buildUniswapSwapTx
} from '../../utils/uniswapArc';

const SYNTHRA_API = import.meta.env.VITE_SYNTHRA_API_BASE || 'https://trading-api.synthra.org';
const SYNTHRA_KEY_TEST = import.meta.env.VITE_SYNTHRA_API_KEY || '';
const SYNTHRA_KEY_PRD  = import.meta.env.VITE_SYNTHRA_API_PRD || import.meta.env.VITE_SYNTHRA_API_KEY || '';
const TOWER_API        = (import.meta.env.VITE_TOWER_API_BASE   || 'https://www.tower.exchange').replace(/\/+$/, '');
const TOWER_KEY_TEST   = import.meta.env.VITE_TOWER_API_KEY_TEST || '';
const TOWER_KEY_PRD    = import.meta.env.VITE_TOWER_API_KEY_PRD  || import.meta.env.VITE_TOWER_API_KEY || '';
const UNISWAP_KEY      = import.meta.env.VITE_UNISWAP_API_KEY || '';

export default function SwapModal({ isOpen, onClose, tokenIn, tokenOut, amountIn, amountOut, rawAmountIn, userAddress, quote, selectedDEX = 'uniswap', slippage = '0.5' }) {
  const chainId = useChainId();
  const activeChainId = chainId === arcTestnet.id ? arcTestnet.id : arcMainnet.id;
  const isMainnet = activeChainId === arcMainnet.id;
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
      // 0. Uniswap V3 Execution (Only when Uniswap is specifically selected)
      if (selectedDEX === 'uniswap') {
        if (isMainnet) {
          // Direct On-Chain Execution on Arc Mainnet
          const tokenInAddress = tokenIn.address;
          const tokenOutAddress = tokenOut.address;

          // Step 0: Check Allowance & Approve if needed
          setCurrentStep(0);
          const currentAllowance = await getUniswapAllowance(tokenInAddress, userAddress);
          if (currentAllowance < BigInt(rawAmountIn)) {
            const approveTx = buildUniswapApproveTx(tokenInAddress, rawAmountIn);
            const approveHash = await window.ethereum.request({
              method: 'eth_sendTransaction',
              params: [{ from: userAddress, to: approveTx.to, data: approveTx.data }],
            });
            await waitForReceipt(approveHash);
          }

          // Step 1: Execute Swap via Arc SwapRouter02
          setCurrentStep(1);
          const swapTx = buildUniswapSwapTx({
            tokenInAddress,
            tokenOutAddress,
            fee: quote?.fee || 500,
            recipient: userAddress,
            amountInRaw: rawAmountIn,
            amountOutRaw: quote?.amountOutRaw,
            slippage: Number(slippage || 0.5),
            path: quote?.path,
            isMultihop: quote?.isMultihop
          });

          const hash = await window.ethereum.request({
            method: 'eth_sendTransaction',
            params: [{
              from: userAddress,
              to: swapTx.to,
              data: swapTx.data,
              value: '0x0',
              gas: arcGasHeadroom(350000)
            }]
          });
          setSwapTxHash(hash);

          // Step 2: Wait confirmation
          setCurrentStep(2);
          await waitForReceipt(hash);
          await new Promise(resolve => setTimeout(resolve, 2000));

          // Step 3: Success
          setCurrentStep(3);
          setStatus('idle');
          saveTrade({
            type: 'Swap',
            walletAddress: userAddress,
            txHash: hash,
            tokenIn: tokenIn.symbol,
            tokenOut: tokenOut.symbol,
            amountIn,
            amountOut,
            status: 'Confirmed',
            chainId: activeChainId,
            provider: 'Uniswap V3'
          });
          return;
        }

        // Testnet or Cross-Chain fallback using API
        if (quote?.uniswapQuote) {
          const buildRes = await fetch('/api/swap/uniswap/build-tx', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              quote: quote.uniswapQuote,
              userAddress
            })
          });
          const buildData = await buildRes.json();
          if (buildRes.ok && buildData?.success) {
            const approveTx = buildData.data?.approval;
            if (approveTx && approveTx.to && approveTx.data) {
              setCurrentStep(0);
              const approveHash = await window.ethereum.request({
                method: 'eth_sendTransaction',
                params: [{ from: userAddress, to: approveTx.to, data: approveTx.data }],
              });
              await waitForReceipt(approveHash);
            }

            setCurrentStep(1);
            const swapTx = buildData.data?.swap || buildData.data?.swapTransaction;
            if (!swapTx || !swapTx.to || !swapTx.data) throw new Error('Uniswap did not return a swap transaction');

            const hash = await window.ethereum.request({
              method: 'eth_sendTransaction',
              params: [{
                from:  userAddress,
                to:    swapTx.to,
                data:  swapTx.data,
                value: swapTx.value ? toHexValue(swapTx.value) : '0x0',
                gas:   arcGasHeadroom(swapTx.gasLimit),
              }],
            });
            setSwapTxHash(hash);

            setCurrentStep(2);
            await waitForReceipt(hash);
            await new Promise(resolve => setTimeout(resolve, 2000));

            setCurrentStep(3);
            setStatus('idle');
            saveTrade({
              type: 'Swap',
              walletAddress: userAddress,
              txHash: hash,
              tokenIn: tokenIn.symbol,
              tokenOut: tokenOut.symbol,
              amountIn,
              amountOut,
              status: 'Confirmed',
              chainId: activeChainId,
              provider: 'Uniswap V3'
            });
            return;
          }
        }

        throw new Error('Uniswap pool is not available for this pair.');
      }
      const activeTowerKey   = chainId === arcMainnet.id ? TOWER_KEY_PRD   : TOWER_KEY_TEST;
      const activeSynthraKey = chainId === arcMainnet.id ? SYNTHRA_KEY_PRD : SYNTHRA_KEY_TEST;
      const isSynthraSelected = selectedDEX === 'synthra';

      // 1. Tower Multi-DEX / UnitFlow execution
      if (!isSynthraSelected && quote?.towerQuote && activeTowerKey) {
        const buildRes = await fetch(`${TOWER_API}/api/public/swap/build-tx`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': activeTowerKey
          },
          body: JSON.stringify({
            quote: quote.towerQuote,
            userAddress
          })
        });
        const buildData = await buildRes.json();
        if (!buildRes.ok || !buildData?.success) {
          throw new Error(buildData?.error || `Tower build-tx error (${buildRes.status})`);
        }

        const approveTx = buildData.data?.approval;
        if (approveTx && approveTx.to && approveTx.data) {
          setCurrentStep(0);
          const approveHash = await window.ethereum.request({
            method: 'eth_sendTransaction',
            params: [{ from: userAddress, to: approveTx.to, data: approveTx.data }],
          });
          await waitForReceipt(approveHash);
        }

        setCurrentStep(1);
        const swapTx = buildData.data?.swap;
        if (!swapTx || !swapTx.to || !swapTx.data) throw new Error('Tower did not return a swap transaction');

        const hash = await window.ethereum.request({
          method: 'eth_sendTransaction',
          params: [{
            from:  userAddress,
            to:    swapTx.to,
            data:  swapTx.data,
            value: swapTx.value ? toHexValue(swapTx.value) : '0x0',
            gas:   arcGasHeadroom(swapTx.gasLimit),
          }],
        });
        setSwapTxHash(hash);

        setCurrentStep(2);
        await waitForReceipt(hash);
        await new Promise(resolve => setTimeout(resolve, 2000));

        setCurrentStep(3);
        setStatus('idle');
        saveTrade({
          type: 'Swap',
          walletAddress: userAddress,
          txHash: hash,
          tokenIn: tokenIn.symbol,
          tokenOut: tokenOut.symbol,
          amountIn,
          amountOut,
          status: 'Confirmed',
          chainId: arcMainnet.id,
          provider: 'Tower Multi-DEX'
        });
        return;
      }

      if (chainId === arcMainnet.id) {
        const dexDisplayName = selectedDEX?.toLowerCase() === 'synthra' 
          ? 'Synthra' 
          : selectedDEX?.toLowerCase() === 'tower' 
            ? 'Tower' 
            : selectedDEX?.toLowerCase() === 'uniswap' 
              ? 'Uniswap' 
              : (selectedDEX ? (selectedDEX.charAt(0).toUpperCase() + selectedDEX.slice(1)) : 'Synthra');
        setStatus('error');
        setErrorMsg(`DEX liquidity pools are awaiting liquidity on Arc Mainnet. Swaps will execute automatically as liquidity is funded on ${dexDisplayName}.`);
        return;
      }
      // Fetch the swap payload
      const res = await fetch(`${SYNTHRA_API}/v1/swap`, {
        method:  'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-KEY': activeSynthraKey
        },
        body: JSON.stringify({
          chainId:      activeChainId,
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
        chainId: activeChainId,
        fromChain: isMainnet ? 'Arc Mainnet' : 'Arc Testnet',
        toChain: isMainnet ? 'Arc Mainnet' : 'Arc Testnet',
        tokenIn: tokenIn.symbol,
        tokenOut: tokenOut.symbol,
        amountIn,
        amountOut,
        txHash: hash,
        hash: hash
      });
    } catch (err) {
      console.error('[SwapModal]', err);
      const lower = (err.message || '').toLowerCase();
      if (err.code === 4001 || lower.includes('user rejected') || lower.includes('cancelled')) {
        setErrorMsg('Transaction rejected in wallet.');
      } else if (lower.includes('transfer amount exceeds balance') || lower.includes('simulation failed') || lower.includes('exceeds balance')) {
        setErrorMsg('Liquidity pool on Arc Mainnet does not have enough reserve for this pair yet. Your funds are 100% safe.');
      } else {
        setErrorMsg(err.message || 'Swap simulation reverted');
      }
      setStatus('error');
    }
  };

  useEffect(() => {
    let timer = null;
    if (isOpen) {
      // Inicia suavemente o fluxo após a transição de abertura do modal
      timer = setTimeout(() => {
        executeSwapFlow();
      }, 120);
    } else {
      // Reseta estado quando fecha
      setCurrentStep(0);
      setStatus('idle');
      setErrorMsg('');
      setSwapTxHash('');
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [isOpen]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18, ease: 'easeOut' }}
          className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
        >
          <motion.div
            initial={{ scale: 0.96, opacity: 0, y: 10 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.96, opacity: 0, y: 10 }}
            transition={{ type: 'spring', damping: 26, stiffness: 350 }}
            className="bg-[#1C1C1E] border border-white/10 rounded-[32px] w-full max-w-[420px] max-h-[90dvh] overflow-y-auto shadow-[0_0_50px_rgba(0,0,0,0.8)] p-6 relative"
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
            <span className="text-sm text-dark-muted font-medium">via {selectedDEX === 'uniswap' ? 'Uniswap V3' : (selectedDEX === 'synthra' ? 'Synthra DEX' : 'Tower Exchange')}</span>
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

          {swapTxHash && currentStep >= 3 && (
            <div className="mt-4 flex flex-col gap-2 items-center text-xs text-dark-muted bg-dark-bg/50 p-3 rounded-xl border border-dark-border/50">
              <div>
                Tx:{' '}
                <a href={`${chainId === arcMainnet.id ? 'https://explorer.arc.io' : 'https://testnet.arcscan.app'}/tx/${swapTxHash}`} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">
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

          {currentStep >= 3 && (
            <button onClick={onClose} className="w-full mt-4 bg-[#4A90E2] hover:bg-[#357ABD] text-white py-3 rounded-xl font-bold transition-all shadow-[0_0_20px_rgba(74,144,226,0.4)]">
              Completed ✓
            </button>
          )}
        </motion.div>
      </motion.div>
      )}
    </AnimatePresence>
  );
}
