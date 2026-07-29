import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { saveTrade } from '../../utils/localStorage';
import { ERC20_ABI } from '../../utils/abis';

// ─── CCTP v2 Arc Testnet Contracts ────────────────────────────────────────────
const TOKEN_MESSENGER_V2    = '0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA';
const MESSAGE_TRANSMITTER_V2 = '0xE737e5cEBEEBa77EFE34D4aa090756590b1CE275';
const ARC_DOMAIN_ID          = 26; // Circle CCTP domain for Arc Testnet
// Use sandbox for testnet — mainnet URL causes 404 on testnet transactions
const IRIS_API               = 'https://iris-api-sandbox.circle.com/v2/messages/26';

// depositForBurn(uint256 amount, uint32 destinationDomain, bytes32 mintRecipient, address burnToken, bytes32 destinationCaller, uint256 maxFee, uint32 finalityThreshold)
// We use a simplified ABI for just what we need
// CCTP v2: depositForBurn has 7 params (added destinationCaller, maxFee, minFinalityThreshold)
const TOKEN_MESSENGER_ABI = [
  {
    name: 'depositForBurn',
    type: 'function',
    inputs: [
      { name: 'amount',                type: 'uint256' },
      { name: 'destinationDomain',     type: 'uint32'  },
      { name: 'mintRecipient',         type: 'bytes32' },
      { name: 'burnToken',             type: 'address' },
      { name: 'destinationCaller',     type: 'bytes32' },
      { name: 'maxFee',                type: 'uint256' },
      { name: 'minFinalityThreshold',  type: 'uint32'  },
    ],
  },
];

const MESSAGE_TRANSMITTER_ABI = [
  {
    name: 'receiveMessage',
    type: 'function',
    inputs: [
      { name: 'message',     type: 'bytes' },
      { name: 'attestation', type: 'bytes' },
    ],
  },
];

// CCTP v2: encode depositForBurn with 7 params
// depositForBurn(uint256 amount, uint32 destinationDomain, bytes32 mintRecipient,
//               address burnToken, bytes32 destinationCaller, uint256 maxFee, uint32 minFinalityThreshold)
// selector: keccak256("depositForBurn(uint256,uint32,bytes32,address,bytes32,uint256,uint32)") = 0x8e0250ee
function encodeDepositForBurn(amount, destinationDomain, mintRecipient, burnToken) {
  const selector            = '8e0250ee';
  const amountHex           = BigInt(amount).toString(16).padStart(64, '0');
  const domainHex           = destinationDomain.toString(16).padStart(64, '0');
  const recipientHex        = mintRecipient.replace('0x', '').padStart(64, '0').toLowerCase();
  const burnTokenHex        = burnToken.replace('0x', '').padStart(64, '0').toLowerCase();
  // destinationCaller = bytes32(0) → any caller can relay the message
  const destCallerHex       = ''.padStart(64, '0');
  // maxFee = 0 → zero-fee transfer (finality threshold 2000 = Full Finality)
  const maxFeeHex           = ''.padStart(64, '0');
  // minFinalityThreshold = 2000 (Full Finality, zero-cost)
  const finalityHex         = (2000).toString(16).padStart(64, '0');
  return `0x${selector}${amountHex}${domainHex}${recipientHex}${burnTokenHex}${destCallerHex}${maxFeeHex}${finalityHex}`;
}

// ─── Helper: encode approve calldata (ERC-20) ──────────────────────────────────
function encodeApprove(spender, amount) {
  // approve(address,uint256)  selector: 0x095ea7b3
  const spenderHex = spender.replace('0x', '').padStart(64, '0').toLowerCase();
  const amountHex  = BigInt(amount).toString(16).padStart(64, '0');
  return `0x095ea7b3${spenderHex}${amountHex}`;
}

// ─── Helper: encode receiveMessage calldata ────────────────────────────────────
function encodeReceiveMessage(messageHex, attestationHex) {
  // receiveMessage(bytes,bytes) selector: keccak256("receiveMessage(bytes,bytes)") = 0x57ecfd28
  const selector = '57ecfd28';
  // offset for first bytes arg = 64, second = 64 + 32 + len(msg)
  const msgBytes  = messageHex.replace('0x', '');
  const attBytes  = attestationHex.replace('0x', '');
  const offset1   = (64).toString(16).padStart(64, '0');
  const msgLen    = (msgBytes.length / 2).toString(16).padStart(64, '0');
  const msgPadded = msgBytes.padEnd(Math.ceil(msgBytes.length / 64) * 64, '0');
  const offset2   = (64 + 32 + Math.ceil(msgBytes.length / 64) * 32).toString(16).padStart(64, '0');
  const attLen    = (attBytes.length / 2).toString(16).padStart(64, '0');
  const attPadded = attBytes.padEnd(Math.ceil(attBytes.length / 64) * 64, '0');
  return `0x${selector}${offset1}${offset2}${msgLen}${msgPadded}${attLen}${attPadded}`;
}

// ─── Helper: convert wallet address to bytes32 ────────────────────────────────
function addressToBytes32(address) {
  return '0x' + address.replace('0x', '').toLowerCase().padStart(64, '0');
}

// ─── Helper: poll Iris API for attestation ────────────────────────────────────
async function pollAttestation(txHash, maxAttempts = 60) {
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise(r => setTimeout(r, 3000)); // wait 3s per attempt
    try {
      const res = await fetch(`${IRIS_API}?transactionHash=${txHash}`);
      if (!res.ok) continue;
      const data = await res.json();
      const msg  = data?.messages?.[0];
      if (msg?.status === 'complete' && msg?.attestation && msg?.message) {
        return { attestation: msg.attestation, message: msg.message };
      }
    } catch (_) { /* keep polling */ }
  }
  throw new Error('Attestation timeout — tente novamente em alguns minutos.');
}

// ─── CCTP Domain map ──────────────────────────────────────────────────────────
// Source: https://developers.circle.com/stablecoins/supported-domains
const CHAIN_DOMAIN_MAP = {
  5042002: 26,  // Arc Testnet
  11155111: 0,  // Ethereum Sepolia
  84532: 6,     // Base Sepolia
  421614: 3,    // Arbitrum Sepolia
  11155420: 2,  // Optimism Sepolia
};

const CHAIN_MESSENGER_MAP = {
  11155111: '0x9f3B8679c73C2Fef8b59B4f3444d4e156fb70AA5', // Ethereum Sepolia TokenMessengerV2
  84532:    '0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA', // Base Sepolia  (same addr pattern)
  421614:   '0x9f3B8679c73C2Fef8b59B4f3444d4e156fb70AA5',
  11155420: '0x9f3B8679c73C2Fef8b59B4f3444d4e156fb70AA5',
  5042002:  TOKEN_MESSENGER_V2,
};

const CHAIN_TRANSMITTER_MAP = {
  11155111: '0x7865fAfC2db2093669d92c0197e5116be03cc232',
  84532:    '0x7865fAfC2db2093669d92c0197e5116be03cc232',
  421614:   '0xaCF1ceeF35caAc005e15888dDb8A3515C41B4872',
  11155420: '0x7865fAfC2db2093669d92c0197e5116be03cc232',
  5042002:  MESSAGE_TRANSMITTER_V2,
};

export default function BridgeModal({ isOpen, onClose, amount, fromChain, toChain, token, userAddress, onComplete }) {
  const [currentStep, setCurrentStep] = useState(0);
  const [status, setStatus] = useState('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [burnTxHash, setBurnTxHash] = useState('');

  // Helper component for timeline dots
  const StepIndicator = ({ stepIndex }) => {
    const isActive = currentStep === stepIndex;
    const isDone = currentStep > stepIndex;
    const isLoading = isActive && status === 'loading';
    if (isDone) return (
      <div className="w-5 h-5 rounded-full bg-[#4A90E2] border-2 border-[#4A90E2] flex items-center justify-center shrink-0">
        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
      </div>
    );
    if (isLoading) return <div className="w-5 h-5 rounded-full border-2 border-[#4A90E2] border-t-transparent animate-spin shrink-0" />;
    return <div className={`w-5 h-5 rounded-full border-2 shrink-0 ${isActive ? 'border-[#4A90E2] bg-[#4A90E2]/20' : 'border-dark-border bg-dark-bg'}`} />;
  };

  const executeBridge = async () => {
    setStatus('loading');
    setErrorMsg('');
    try {
      if (!userAddress) throw new Error('Carteira não conectada.');
      if (!token || typeof token.decimals !== 'number') throw new Error('Token inválido.');
      const amtNum = Number(amount || 0);
      if (amtNum <= 0) throw new Error('Valor inválido.');

      const rawAmount = BigInt(Math.floor(amtNum * (10 ** token.decimals))).toString();
      const fromChainId = fromChain?.id || 5042002;
      const toChainId   = toChain?.id   || 11155111;

      const srcMessenger    = CHAIN_MESSENGER_MAP[fromChainId]    || TOKEN_MESSENGER_V2;
      const dstTransmitter  = CHAIN_TRANSMITTER_MAP[toChainId]    || MESSAGE_TRANSMITTER_V2;
      const destinationDomain = CHAIN_DOMAIN_MAP[toChainId];

      if (destinationDomain === undefined) throw new Error(`Rede de destino não suportada (chainId ${toChainId})`);

      // ── STEP 0: APPROVE ────────────────────────────────────────────────────
      setCurrentStep(0);
      
      const approveData = encodeApprove(srcMessenger, rawAmount);
      const approveHash = await window.ethereum.request({
        method: 'eth_sendTransaction',
        params: [{ from: userAddress, to: token.address, data: approveData }],
      });
      // Wait for approve receipt
      await waitForTxReceipt(approveHash);

      // ── STEP 1: BURN (depositForBurn) ──────────────────────────────────────
      setCurrentStep(1);
      const mintRecipient = addressToBytes32(userAddress);
      const burnData = encodeDepositForBurn(rawAmount, destinationDomain, mintRecipient, token.address);
      const txParams = { from: userAddress, to: srcMessenger, data: burnData, gas: '0x3D0900' }; // 4M gas limit for Arc

      const burnHash = await window.ethereum.request({
        method: 'eth_sendTransaction',
        params: [txParams],
      });
      setBurnTxHash(burnHash);
      await waitForTxReceipt(burnHash);

      // ── STEP 2: FETCH ATTESTATION (Iris API) ───────────────────────────────
      setCurrentStep(2);
      const { attestation, message } = await pollAttestation(burnHash);

      // ── STEP 3: MINT (receiveMessage on destination) ───────────────────────
      setCurrentStep(3);
      // Note: user must switch to destination chain in wallet for this step
      const receiveData = encodeReceiveMessage(message, attestation);
      await window.ethereum.request({
        method: 'eth_sendTransaction',
        params: [{ from: userAddress, to: dstTransmitter, data: receiveData }],
      });

      // ── STEP 4: SUCCESS ────────────────────────────────────────────────────
      setCurrentStep(4);
      setStatus('idle');
      saveTrade({
        type: 'Bridge',
        walletAddress: userAddress,
        tokenIn: token?.symbol,
        amountIn: amount,
        fromChain: fromChain?.name,
        toChain: toChain?.name,
        txHash: burnHash,
      });
      setTimeout(() => { if (onComplete) onComplete(); }, 2000);

    } catch (err) {
      console.error('[BridgeModal CCTP]', err);
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
      setCurrentStep(0); setStatus('idle'); setErrorMsg(''); setBurnTxHash('');
      const t = setTimeout(() => {
        if (amount && Number(amount) > 0) {
          executeBridge();
        } else {
          setErrorMsg('Informe um valor maior que 0 para realizar a bridge.');
          setStatus('error');
        }
      }, 500);
      return () => clearTimeout(t);
    }
  }, [isOpen, amount]);

  if (!isOpen) return null;

  const steps = [
    { label: `Approve ${token?.symbol}`,     hint: 'Aprovando na carteira...' },
    { label: 'Burn (depositForBurn)',         hint: 'Confirmar na carteira...' },
    { label: 'Buscar Atestado (Circle Iris)', hint: 'Aguarde ~30 segundos...' },
    { label: 'Mint na rede destino',          hint: 'Trocar rede na carteira...' },
    { label: `${amount} ${token?.symbol} recebido!`, hint: '' },
  ];

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
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
          <button onClick={onClose} className="absolute top-5 right-5 text-dark-muted hover:text-white transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>

          <div className="flex flex-col items-center mt-2 mb-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-[#2C2C2E] relative shrink-0 p-[2px]">
                <img src={fromChain?.icon} alt={fromChain?.name} className="w-full h-full rounded-full" />
              </div>
              <svg className="w-5 h-5 text-dark-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
              <div className="w-12 h-12 rounded-full bg-[#2C2C2E] relative shrink-0 p-[2px]">
                <img src={toChain?.icon} alt={toChain?.name} className="w-full h-full rounded-full" />
              </div>
            </div>
            <h2 className="text-[22px] font-bold text-white tracking-tight mb-1 text-center">
              Bridge {amount} {token?.symbol}
            </h2>
            <span className="text-sm text-dark-muted font-medium">via Circle CCTP v2</span>
          </div>

          <div className="bg-transparent border border-dark-border/60 rounded-3xl p-5 relative">
            <div className="absolute left-[29px] top-[38px] bottom-[48px] w-[2px] bg-dark-border/40 z-0" />
            {steps.map((step, i) => (
              <div key={i} className={`flex items-center gap-4 relative z-10 ${i < steps.length - 1 ? 'mb-6' : ''}`}>
                <StepIndicator stepIndex={i} />
                <div className="flex-1 flex justify-between items-center">
                  <span className={`font-semibold text-[15px] ${currentStep >= i ? 'text-white' : 'text-dark-muted'}`}>{step.label}</span>
                  {currentStep === i && status === 'loading' && step.hint && (
                    <span className="text-[13px] text-[#4A90E2]">{step.hint}</span>
                  )}
                </div>
              </div>
            ))}
          </div>

          {burnTxHash && (
            <div className="mt-3 text-center text-xs text-dark-muted">
              Burn Tx:{' '}
              <a href={`https://testnet.arcscan.app/tx/${burnTxHash}`} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">
                {burnTxHash.slice(0, 12)}...{burnTxHash.slice(-6)}
              </a>
            </div>
          )}

          {errorMsg && (
            <div className="mt-4 p-3 bg-red-900/30 border border-red-500/50 rounded-xl text-xs text-red-400 text-center">
              ⚠️ {errorMsg}
              <button onClick={() => { setErrorMsg(''); executeBridge(); }} className="block mx-auto mt-2 text-xs text-blue-400 hover:underline">
                Tentar novamente
              </button>
            </div>
          )}

          {currentStep === 4 && (
            <button onClick={onClose} className="w-full mt-4 bg-[#2C2C2E] hover:bg-[#3C3C3E] text-white py-3 rounded-xl font-bold transition-all">
              Concluído ✓
            </button>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// ─── Helper: wait for receipt ──────────────────────────────────────────────────
// Use the wallet's injected provider to avoid CORS issues with direct RPC calls
async function waitForTxReceipt(hash, attempts = 90) {
  for (let i = 0; i < attempts; i++) {
    try {
      const receipt = await window.ethereum.request({
        method: 'eth_getTransactionReceipt',
        params: [hash],
      });
      if (receipt) {
        const statusNum = parseInt(receipt.status, 16);
        if (statusNum === 0) throw new Error('Transação revertida na chain.');
        return; // success
      }
    } catch (err) {
      // If it's a revert error, rethrow immediately
      if (err.message?.includes('revertida')) throw err;
      // Otherwise it's a connectivity error, keep polling
    }
    await new Promise(r => setTimeout(r, 2000));
  }
  throw new Error('Timeout aguardando confirmação da transação.');
}
