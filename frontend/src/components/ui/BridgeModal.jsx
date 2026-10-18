import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { saveTrade, savePendingBridge, clearPendingBridge, updateTradeByHash } from '../../utils/localStorage';
import { ERC20_ABI } from '../../utils/abis';
import { encodeFunctionData, encodeAbiParameters, parseAbiParameters, getAddress } from 'viem';
import { useSwitchChain } from 'wagmi';
// CCTP v2 Arc Testnet Contracts 
const TOKEN_MESSENGER_V2    = '0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA';
const MESSAGE_TRANSMITTER_V2 = '0xE737e5cEBEEBa77EFE34D4aa090756590b1CE275';
const ARC_DOMAIN_ID          = 26; // Circle CCTP domain for Arc Testnet
// Use sandbox for testnet - mainnet URL causes 404 on testnet transactions
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
const DEPOSIT_FOR_BURN_ABI = [{
  name: 'depositForBurn',
  type: 'function',
  inputs: [
    { name: 'amount',               type: 'uint256' },
    { name: 'destinationDomain',    type: 'uint32'  },
    { name: 'mintRecipient',        type: 'bytes32' },
    { name: 'burnToken',            type: 'address' },
    { name: 'destinationCaller',    type: 'bytes32' },
    { name: 'maxFee',               type: 'uint256' },
    { name: 'minFinalityThreshold', type: 'uint32'  },
  ],
}];

const APPROVE_ABI = [{
  name: 'approve',
  type: 'function',
  inputs: [
    { name: 'spender', type: 'address' },
    { name: 'amount',  type: 'uint256' },
  ],
}];

const RECEIVE_MESSAGE_ABI = [{
  name: 'receiveMessage',
  type: 'function',
  inputs: [
    { name: 'message',     type: 'bytes' },
    { name: 'attestation', type: 'bytes' },
  ],
}];

function encodeDepositForBurn(amount, destinationDomain, mintRecipient, burnToken, maxFee = 0n, minFinalityThreshold = 1000) {
  return encodeFunctionData({
    abi: DEPOSIT_FOR_BURN_ABI,
    functionName: 'depositForBurn',
    args: [
      BigInt(amount),
      destinationDomain,
      mintRecipient,           // already bytes32 hex string
      getAddress(burnToken),   // checksum-safe address
      '0x' + '0'.repeat(64),  // destinationCaller = bytes32(0)
      BigInt(maxFee),          // maxFee (atomic units / wei)
      minFinalityThreshold,    // 1000 = Fast Transfer (sub-minute finality)
    ],
  });
}

function encodeApprove(spender, amount) {
  return encodeFunctionData({
    abi: APPROVE_ABI,
    functionName: 'approve',
    args: [getAddress(spender), BigInt(amount)],
  });
}

function encodeReceiveMessage(messageHex, attestationHex) {
  return encodeFunctionData({
    abi: RECEIVE_MESSAGE_ABI,
    functionName: 'receiveMessage',
    args: [messageHex, attestationHex],
  });
}

function encodeTransfer(recipient, amount) {
  return encodeFunctionData({
    abi: [{ name: 'transfer', type: 'function', inputs: [{ name: 'to', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [{ name: '', type: 'bool' }] }],
    functionName: 'transfer',
    args: [getAddress(recipient), BigInt(amount)],
  });
}

// Treasury Configuration
import { TREASURY_ADDRESS, BRIDGE_FEE } from '../../config/constants';

// Helper: convert wallet address to bytes32 
function addressToBytes32(address) {
  return '0x' + address.replace('0x', '').toLowerCase().padStart(64, '0');
}

// Official CCTP V2 Mainnet Contract Deployments (Shared across EVM chains)
const CCTP_V2_MAINNET_MESSENGER   = '0x28b5a0e9C621a5BadaA536219b3a228C8168cf5d';
const CCTP_V2_MAINNET_TRANSMITTER = '0x81D40F21F12A8F0E3252Bccb954D722d4c464B64';

// CCTP Domain map 
// Source: https://developers.circle.com/stablecoins/supported-domains
const CHAIN_DOMAIN_MAP = {
  // Testnet
  5042002: 26,  // Arc Testnet
  11155111: 0,  // Ethereum Sepolia
  84532: 6,     // Base Sepolia
  421614: 3,    // Arbitrum Sepolia
  11155420: 2,  // Optimism Sepolia
  // Mainnet
  5042: 26,     // Arc Mainnet
  1: 0,         // Ethereum Mainnet
  10: 2,        // Optimism Mainnet
  42161: 3,     // Arbitrum One
  8453: 6,      // Base Mainnet
  137: 7,       // Polygon PoS
};

// Helper: poll Iris API for attestation with live progress updates
async function pollAttestation(txHash, fromChainId, onProgress = null, maxAttempts = 360) {
  const isMainnet = fromChainId === 5042 || fromChainId === 1 || fromChainId === 8453 || fromChainId === 42161 || fromChainId === 10 || fromChainId === 137;
  const primaryDomain = CHAIN_DOMAIN_MAP[fromChainId] ?? 26;
  const baseUrl = isMainnet 
    ? 'https://iris-api.circle.com' 
    : 'https://iris-api-sandbox.circle.com';

  const candidateDomains = [primaryDomain, 26, 6, 0, 3, 2, 7].filter((v, i, a) => a.indexOf(v) === i);

  const startTime = Date.now();
  for (let i = 0; i < maxAttempts; i++) {
    if (i > 0) {
      await new Promise(r => setTimeout(r, 3500)); // wait 3.5s per attempt
    }
    const elapsedSec = Math.floor((Date.now() - startTime) / 1000);
    const mins = Math.floor(elapsedSec / 60);
    const secs = elapsedSec % 60;
    const timeStr = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;

    for (const domain of candidateDomains) {
      try {
        const res = await fetch(`${baseUrl}/v2/messages/${domain}?transactionHash=${txHash}`);
        if (!res.ok) continue;
        const data = await res.json();
        const msg  = data?.messages?.[0];
        if (msg?.status === 'complete' && msg?.attestation && msg?.message) {
          if (onProgress) onProgress({ status: 'complete', timeStr, elapsedSec });
          return { attestation: msg.attestation, message: msg.message };
        } else if (msg) {
          const circleStatus = msg?.status || 'pending_confirmations';
          if (onProgress) onProgress({ status: circleStatus, timeStr, elapsedSec });
          break; // Found the right source domain, stay on it for next poll
        }
      } catch (_) {}
    }
    if (onProgress) onProgress({ status: 'connecting', timeStr, elapsedSec });
  }
  throw new Error('Circle verification timeout. The transaction is still being validated on-chain. You can safely retry or resume anytime.');
}

// Helper: query Circle Iris API for route fee (bps) for Fast Transfer (threshold: 1000)
async function getCctpFastTransferParams(fromChainId, toChainId, rawAmount) {
  const isMainnet = fromChainId === 5042 || fromChainId === 1 || fromChainId === 8453 || fromChainId === 42161 || fromChainId === 10 || fromChainId === 137;
  const srcDomain = CHAIN_DOMAIN_MAP[fromChainId] ?? 26;
  const dstDomain = CHAIN_DOMAIN_MAP[toChainId] ?? 6;
  const baseUrl = isMainnet ? 'https://iris-api.circle.com' : 'https://iris-api-sandbox.circle.com';

  let maxFee = 0n;
  const minFinalityThreshold = 1000; // 1000 = Fast Transfer tier (sub-minute attestation)

  try {
    const res = await fetch(`${baseUrl}/v2/burn/USDC/fees/${srcDomain}/${dstDomain}`);
    if (res.ok) {
      const data = await res.json();
      const fastTier = Array.isArray(data) ? data.find(t => t.finalityThreshold === 1000) : null;
      if (fastTier && typeof fastTier.minimumFee === 'number' && fastTier.minimumFee > 0) {
        // minimumFee is in basis points (1 = 0.01%). Add 50% safety buffer.
        const multiplier = BigInt(Math.ceil(fastTier.minimumFee * 1500));
        maxFee = (BigInt(rawAmount) * multiplier) / 10000000n;
        if (maxFee === 0n && fastTier.minimumFee > 0) {
          maxFee = 100n; // fallback to minimum subunits (0.0001 USDC)
        }
      }
    }
  } catch (err) {
    console.warn('[CCTP Fast Transfer] Failed to fetch fee, using fallback:', err);
    maxFee = BigInt(rawAmount) / 10000n;
  }

  return { maxFee, minFinalityThreshold };
}

const CHAIN_MESSENGER_MAP = {
  // Testnet
  11155111: '0x9f3B8679c73C2Fef8b59B4f3444d4e156fb70AA5', // Ethereum Sepolia TokenMessengerV2
  84532:    '0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA', // Base Sepolia
  421614:   '0x9f3B8679c73C2Fef8b59B4f3444d4e156fb70AA5',
  11155420: '0x9f3B8679c73C2Fef8b59B4f3444d4e156fb70AA5',
  5042002:  TOKEN_MESSENGER_V2,
  // Mainnet
  5042:     CCTP_V2_MAINNET_MESSENGER,
  8453:     CCTP_V2_MAINNET_MESSENGER,
  42161:    CCTP_V2_MAINNET_MESSENGER,
  10:       CCTP_V2_MAINNET_MESSENGER,
  1:        CCTP_V2_MAINNET_MESSENGER,
  137:      CCTP_V2_MAINNET_MESSENGER,
};

const CHAIN_TRANSMITTER_MAP = {
  // Testnet
  11155111: MESSAGE_TRANSMITTER_V2,
  84532:    MESSAGE_TRANSMITTER_V2,
  421614:   MESSAGE_TRANSMITTER_V2,
  11155420: MESSAGE_TRANSMITTER_V2,
  64165:    MESSAGE_TRANSMITTER_V2,
  5042002:  MESSAGE_TRANSMITTER_V2,
  // Mainnet
  5042:     CCTP_V2_MAINNET_TRANSMITTER,
  8453:     CCTP_V2_MAINNET_TRANSMITTER,
  42161:    CCTP_V2_MAINNET_TRANSMITTER,
  10:       CCTP_V2_MAINNET_TRANSMITTER,
  1:        CCTP_V2_MAINNET_TRANSMITTER,
  137:      CCTP_V2_MAINNET_TRANSMITTER,
};

export default function BridgeModal({ isOpen, onClose, amount, fromChain, toChain, token, userAddress, receiverAddress, initialBurnTxHash, onComplete }) {
  const [currentStep, setCurrentStep] = useState(0);
  const [status, setStatus] = useState('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [burnTxHash, setBurnTxHash] = useState(initialBurnTxHash || '');
  const [receiveTxHash, setReceiveTxHash] = useState('');
  const [attestationStatus, setAttestationStatus] = useState(null);
  const [rescueHashInput, setRescueHashInput] = useState('');
  const [showRescueInput, setShowRescueInput] = useState(false);
  const isExecutingRef = useRef(false);
  const hasStartedRef = useRef(false);

  const handleClose = () => {
    hasStartedRef.current = false;
    isExecutingRef.current = false;
    const finalBurn = burnTxHash;
    const finalReceive = receiveTxHash;
    setBurnTxHash('');
    if (currentStep === 4 && onComplete) {
      onComplete({ burnTxHash: finalBurn, receiveTxHash: finalReceive, amount, fromChain, toChain, token });
    }
    if (onClose) {
      onClose();
    }
  };
  const { switchChainAsync } = useSwitchChain();

  // Helper component for timeline dots
  const StepIndicator = ({ stepIndex }) => {
    const isActive = currentStep === stepIndex;
    const isDone = currentStep > stepIndex || (stepIndex === steps.length - 1 && currentStep === stepIndex && status === 'idle');
    const isLoading = isActive && status === 'loading';
    if (isDone) return (
      <div className="w-5 h-5 rounded-full bg-[#4A90E2] border-2 border-[#4A90E2] flex items-center justify-center shrink-0">
        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
      </div>
    );
    if (isLoading) return <div className="w-5 h-5 rounded-full border-2 border-[#4A90E2] border-t-transparent animate-spin shrink-0 shadow-[0_0_12px_rgba(74,144,226,0.6)]" />;
    return <div className={`w-5 h-5 rounded-full border-2 shrink-0 transition-all ${isActive ? 'border-[#4A90E2] bg-[#4A90E2]/20 shadow-[0_0_12px_rgba(74,144,226,0.4)]' : 'border-dark-border bg-transparent'}`} />;
  };

  const executeBridge = async (existingHash = null) => {
    if (isExecutingRef.current) return;
    isExecutingRef.current = true;
    setStatus('loading');
    setErrorMsg('');
    try {
      if (!userAddress) throw new Error('Wallet not connected.');
      const fromChainId = fromChain?.id || 5042002;
      const toChainId   = toChain?.id   || 11155111;

      const srcMessenger      = CHAIN_MESSENGER_MAP[fromChainId]    || TOKEN_MESSENGER_V2;
      const dstTransmitter    = CHAIN_TRANSMITTER_MAP[toChainId]    || MESSAGE_TRANSMITTER_V2;
      const destinationDomain = CHAIN_DOMAIN_MAP[toChainId];

      if (destinationDomain === undefined) throw new Error(`Destination network not supported (chainId ${toChainId})`);

      let activeBurnHash = existingHash || initialBurnTxHash || null;

      // STEP 0 & STEP 1: APPROVE AND BURN (Only executed if no burn hash exists yet)
      if (!activeBurnHash) {
        if (!token || typeof token.decimals !== 'number') throw new Error('Invalid token.');
        const amtNum = Number(amount || 0);
        const hasFee = BRIDGE_FEE > 0 && amtNum > BRIDGE_FEE;
        const netBridgeAmt = hasFee ? (amtNum - BRIDGE_FEE) : amtNum;

        // Use BigInt math to avoid JavaScript float precision errors
        const decimals = token.decimals;
        const [intPart, decPart = ''] = String(netBridgeAmt.toFixed(6)).replace(/0+$/, '').split('.');
        const decPadded = (decPart + '0'.repeat(decimals)).slice(0, decimals);
        const rawAmount = (BigInt(intPart) * BigInt(10 ** decimals) + BigInt(decPadded || '0')).toString();

        // Ensure we're on the source chain and verify wallet actively switched
        try {
          const currentChainHex = await window.ethereum?.request({ method: 'eth_chainId' });
          const currentChainId = currentChainHex ? parseInt(currentChainHex, 16) : null;
          if (currentChainId && currentChainId !== fromChainId) {
            await switchChainAsync({ chainId: fromChainId });
            await new Promise(r => setTimeout(r, 800));
            const postSwitchHex = await window.ethereum?.request({ method: 'eth_chainId' });
            if (postSwitchHex && parseInt(postSwitchHex, 16) !== fromChainId) {
              throw new Error(`Please confirm the network switch to ${fromChain?.name || 'source'} in your wallet.`);
            }
          }
        } catch (err) {
          throw new Error(err.message || `You must switch to ${fromChain?.name || 'source'} network to start the bridge.`);
        }

        // Check existing ERC-20 allowance to avoid redundant approvals
        let currentAllowance = 0n;
        try {
          const allowanceCallData = encodeFunctionData({
            abi: ERC20_ABI,
            functionName: 'allowance',
            args: [getAddress(userAddress), getAddress(srcMessenger)],
          });
          const allowanceHex = await window.ethereum.request({
            method: 'eth_call',
            params: [{ to: token.address, data: allowanceCallData }, 'latest'],
          });
          if (allowanceHex && allowanceHex !== '0x') {
            currentAllowance = BigInt(allowanceHex);
          }
        } catch (allowanceErr) {
          console.warn('[BridgeModal] Allowance check fallback:', allowanceErr);
        }

        // STEP 0: APPROVE (only prompted if allowance is insufficient - standard 1st popup)
        const requiredAllowance = BigInt(rawAmount);
        if (currentAllowance < requiredAllowance) {
          setCurrentStep(0);
          // Standard infinite approval (Circle CCTP official best practice)
          const MAX_UINT256_HEX = '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';
          const approveData = encodeApprove(srcMessenger, MAX_UINT256_HEX);
          const approveHash = await window.ethereum.request({
            method: 'eth_sendTransaction',
            params: [{ from: userAddress, to: token.address, data: approveData }],
          });
          await waitForTxReceipt(approveHash);
        }

        // STEP 1: BURN (depositForBurn - standard 2nd popup, zero extra fee transactions)
        setCurrentStep(1);

        const mintRecipient = addressToBytes32(receiverAddress || userAddress);
        const { maxFee, minFinalityThreshold } = await getCctpFastTransferParams(fromChainId, toChainId, rawAmount);
        const burnData = encodeDepositForBurn(rawAmount, destinationDomain, mintRecipient, token.address, maxFee, minFinalityThreshold);
        
        // Dynamically estimate gas with 25% safety buffer instead of hardcoding 4,000,000 gas
        let gasLimitHex = undefined;
        try {
          const estGas = await window.ethereum.request({
            method: 'eth_estimateGas',
            params: [{ from: userAddress, to: srcMessenger, data: burnData }],
          });
          if (estGas) {
            const buffered = (BigInt(estGas) * 125n) / 100n;
            gasLimitHex = '0x' + buffered.toString(16);
          }
        } catch (gasEstErr) {
          console.warn('[BridgeModal] Gas estimation fallback:', gasEstErr);
          gasLimitHex = '0x493E0'; // 300,000 gas fallback (realistic, prevents excessive gas reserve errors)
        }

        const txParams = { from: userAddress, to: srcMessenger, data: burnData };
        if (gasLimitHex) txParams.gas = gasLimitHex;

        activeBurnHash = await window.ethereum.request({
          method: 'eth_sendTransaction',
          params: [txParams],
        });
        setBurnTxHash(activeBurnHash);
        await waitForTxReceipt(activeBurnHash);

        // Immediately persist pending bridge to localStorage
        savePendingBridge({
          burnHash: activeBurnHash,
          fromChainId,
          toChainId,
          fromChainName: fromChain?.name,
          toChainName: toChain?.name,
          amount,
          tokenSymbol: token?.symbol,
          userAddress,
          receiverAddress: receiverAddress || userAddress,
          timestamp: Date.now(),
        });

        // Also record in trade history with pending status
        saveTrade({
          id: activeBurnHash,
          type: 'Bridge',
          status: 'pending_attestation',
          walletAddress: userAddress,
          chainId: fromChainId,
          tokenIn: token?.symbol,
          tokenOut: token?.symbol,
          amountIn: amount,
          amountOut: netBridgeAmt,
          fromChain: fromChain?.name,
          toChain: toChain?.name,
          txHash: activeBurnHash,
          hash: activeBurnHash,
        });
      } else {
        setBurnTxHash(activeBurnHash);
      }

      // STEP 2 & 3: FETCH ATTESTATION & WAIT FOR FINALITY
      setCurrentStep(2);
      setAttestationStatus({ status: 'pending_confirmations', timeStr: '00:00' });
      const { attestation, message } = await pollAttestation(
        activeBurnHash, 
        fromChainId, 
        (progress) => {
          setAttestationStatus(progress);
          if (progress.elapsedSec >= 4) {
            setCurrentStep(3);
          }
        }
      );

      // STEP 4: MINT ON DESTINATION CHAIN
      setCurrentStep(4);

      let alreadyMinted = false;

      // Extract destination domain directly from the validated Circle message payload
      const { ethers } = await import('ethers');
      const msgBytes = ethers.getBytes(message);
      const parsedDstDomain = ethers.getNumber(ethers.dataSlice(msgBytes, 8, 12));
      const DOMAIN_TO_CHAIN = {
        6: 8453,   // Base Mainnet
        26: 5042,  // Arc Mainnet
        3: 42161,  // Arbitrum One
        2: 10,     // Optimism Mainnet
        0: 1,      // Ethereum Mainnet
        7: 137,    // Polygon PoS
      };
      const actualToChainId = DOMAIN_TO_CHAIN[parsedDstDomain] || toChainId;
      const actualDstTransmitter = CHAIN_TRANSMITTER_MAP[actualToChainId] || dstTransmitter;

      // 1. Silent Check: Check destination chain RPC to see if nonce is already consumed
      try {
        const destRpc = actualToChainId === 8453 
          ? 'https://mainnet.base.org' 
          : (actualToChainId === 5042 ? 'https://rpc.mainnet.arc.io' : (toChain?.rpcUrls?.default?.http?.[0] || 'https://mainnet.base.org'));
        const destProvider = new ethers.JsonRpcProvider(destRpc);
        const transmitterContract = new ethers.Contract(actualDstTransmitter, ['function usedNonces(bytes32) view returns (uint256)'], destProvider);
        const sourceDomain = ethers.getNumber(ethers.dataSlice(msgBytes, 4, 8));
        const nonce = ethers.toBigInt(ethers.dataSlice(msgBytes, 12, 20));
        const sourceAndNonce = ethers.keccak256(ethers.solidityPacked(['uint32', 'uint64'], [sourceDomain, nonce]));
        const isUsed = await transmitterContract.usedNonces(sourceAndNonce);
        if (Number(isUsed) > 0) {
          console.log('[BridgeModal] Message already minted on destination!');
          alreadyMinted = true;
        }
      } catch (checkErr) {
        console.warn('[BridgeModal] Destination nonce check notice:', checkErr);
      }

      if (!alreadyMinted) {
        // 2. Try backend relayer (production Vercel endpoint)
        let relayerWorked = false;
        try {
          const relayerRes = await fetch('/api/relayer/bridge', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              message,
              attestation,
              destinationChainId: actualToChainId,
              dstTransmitter: actualDstTransmitter
            })
          });

          const data = await relayerRes.json().catch(() => null);
          if (data?.txHash) {
            console.log('[BridgeModal] Relayer broadcasted!', data.txHash);
            setReceiveTxHash(data.txHash);
            relayerWorked = true;
            alreadyMinted = true;
          } else if (data?.alreadyMinted) {
            relayerWorked = true;
            alreadyMinted = true;
          }
        } catch (_) {}

        // 3. Fallback: If relayer is not running (e.g. on localhost), prompt wallet to mint on destination
        if (!relayerWorked && !alreadyMinted) {
          const receiveData = encodeReceiveMessage(message, attestation);

          // Verify network switch to destination
          try {
            await switchChainAsync({ chainId: actualToChainId });
          } catch (switchErr) {
            throw new Error(`Please switch network to destination chain in your wallet to complete the mint.`);
          }

          // Wait until wallet actively reflects destination chain
          let isCorrectChain = false;
          for (let attempt = 0; attempt < 10; attempt++) {
            await new Promise(r => setTimeout(r, 600));
            const currentChainHex = await window.ethereum?.request({ method: 'eth_chainId' });
            if (currentChainHex && parseInt(currentChainHex, 16) === actualToChainId) {
              isCorrectChain = true;
              break;
            }
          }

          if (!isCorrectChain) {
            throw new Error(`Please switch to destination network in your wallet to finish delivery.`);
          }

          let gasLimitHex = undefined;
          try {
            const estGas = await window.ethereum.request({
              method: 'eth_estimateGas',
              params: [{ from: userAddress, to: actualDstTransmitter, data: receiveData }],
            });
            if (estGas) {
              const buffered = (BigInt(estGas) * 125n) / 100n;
              gasLimitHex = '0x' + buffered.toString(16);
            }
          } catch (gasErr) {
            gasLimitHex = '0x493E0'; // 300,000 gas fallback
          }

          const txParams = { from: userAddress, to: actualDstTransmitter, data: receiveData };
          if (gasLimitHex) txParams.gas = gasLimitHex;

          const receiveHash = await window.ethereum.request({
            method: 'eth_sendTransaction',
            params: [txParams],
          });
          setReceiveTxHash(receiveHash);
          await waitForTxReceipt(receiveHash);
        }
      }

      // STEP 4: SUCCESS
      setCurrentStep(4);
      setStatus('idle');
      clearPendingBridge(userAddress);
      updateTradeByHash(activeBurnHash, { status: 'Completed' });
      window.dispatchEvent(new Event('aura:bridge-complete'));

    } catch (err) {
      console.error('[BridgeModal CCTP]', err);
      const isUserReject = 
        err?.code === 4001 || 
        err?.cause?.code === 4001 ||
        err?.message?.toLowerCase().includes('user rejected') ||
        err?.message?.toLowerCase().includes('cancelled') ||
        err?.message?.toLowerCase().includes('canceled') ||
        err?.message?.toLowerCase().includes('denied');

      if (isUserReject) {
        setErrorMsg('Transaction cancelled in your wallet.');
      } else {
        setErrorMsg(err.message || 'Unknown error');
      }
      setStatus('error');
    } finally {
      isExecutingRef.current = false;
    }
  };

  useEffect(() => {
    if (isOpen) {
      if (hasStartedRef.current) return;
      hasStartedRef.current = true;

      setErrorMsg(''); 
      setReceiveTxHash('');
      const targetBurn = initialBurnTxHash || null;
      if (targetBurn) {
        setBurnTxHash(targetBurn);
        setCurrentStep(2);
        setStatus('loading');
        executeBridge(targetBurn);
      } else if (amount && Number(amount) > 0) {
        setBurnTxHash('');
        setCurrentStep(0); 
        setStatus('idle');
        const t = setTimeout(() => {
          executeBridge();
        }, 500);
        return () => clearTimeout(t);
      } else {
        setBurnTxHash('');
        setCurrentStep(0);
        setStatus('idle');
        setShowRescueInput(true);
      }
    } else {
      hasStartedRef.current = false;
      isExecutingRef.current = false;
      setBurnTxHash('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const amtNum = Math.max(0, Number(amount || 0));
  const hasFee = BRIDGE_FEE > 0 && amtNum > BRIDGE_FEE;
  const netAmountNum = hasFee ? (amtNum - BRIDGE_FEE) : amtNum;
  const amountDisplay = amtNum.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 6 });
  const netAmountDisplay = netAmountNum.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 6 });

  const getEstimatedTime = (fromId, toId) => {
    const isEthL1 = fromId === 1 || fromId === 11155111 || toId === 1 || toId === 11155111;
    if (isEthL1) return '1-2 min';
    return '20-30 sec';
  };

  const steps = [
    { label: `Approve ${token?.symbol || 'USDC'}`, hint: 'Approving in your wallet' },
    { label: 'Burn', hint: 'Burning on source network' },
    { label: 'Fetch Attestation', hint: 'Circle validation in progress' },
    { label: `Wait ~${getEstimatedTime(fromChain?.id, toChain?.id)}`, hint: 'Processing cross-chain finality' },
    { label: `Mint ${netAmountDisplay} ${token?.symbol || 'USDC'} on ${toChain?.name || 'Arc'}`, hint: 'Delivering tokens to recipient' },
  ];

  const handleRescueSubmit = (e) => {
    e.preventDefault();
    if (!rescueHashInput || !rescueHashInput.startsWith('0x') || rescueHashInput.length < 32) {
      setErrorMsg('Please enter a valid transaction hash starting with 0x');
      return;
    }
    setShowRescueInput(false);
    setBurnTxHash(rescueHashInput.trim());
    executeBridge(rescueHashInput.trim());
  };

  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-5 bg-black/75 backdrop-blur-md overflow-y-auto"
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 20 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="bg-[#1C1C1E] border border-white/10 rounded-2xl sm:rounded-[32px] w-full max-w-[420px] max-h-[90dvh] overflow-y-auto shadow-[0_0_50px_rgba(0,0,0,0.8)] p-5 sm:p-6 my-auto relative"
          onClick={(e) => e.stopPropagation()}
        >
          <button onClick={handleClose} className="absolute top-5 right-5 text-dark-muted hover:text-white transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>

          <div className="flex flex-col items-center mt-2 mb-6">
            <div className="relative mb-3">
              <div className="w-14 h-14 rounded-full bg-[#2775CA]/10 border border-[#2775CA]/20 flex items-center justify-center p-2.5 shadow-[0_0_20px_rgba(39,117,202,0.25)]">
                <img
                  src={token?.iconImg || '/tokens/usdc.svg'}
                  alt={token?.symbol || 'USDC'}
                  className="w-full h-full object-contain"
                />
              </div>
              <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-[#1C1C1E] border border-white/10 flex items-center justify-center p-0.5">
                <img src={fromChain?.icon} alt={fromChain?.name} className="w-full h-full rounded-full" />
              </div>
            </div>

            <h2 className="text-[22px] font-bold text-white tracking-tight mb-0.5 text-center">
              Bridge {netAmountDisplay} {token?.symbol || 'USDC'}
            </h2>
            <div className="flex items-center gap-1.5 text-xs text-dark-muted font-medium mb-3">
              <span>via Circle CCTP</span>
              {hasFee ? (
                <>
                  <span>•</span>
                  <span>{BRIDGE_FEE.toFixed(2)} fee</span>
                </>
              ) : (
                <>
                  <span>•</span>
                  <span className="text-emerald-400 font-semibold">Zero Fee (1:1)</span>
                </>
              )}
            </div>

            <div className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-[11px] font-bold text-white/80">
              Steps
            </div>
          </div>

          <div className="bg-white/[0.02] border border-white/5 shadow-[0_0_20px_rgba(0,0,0,0.3)] backdrop-blur-xl rounded-3xl p-5 relative">
            <div className="absolute left-[29px] top-[38px] bottom-[48px] w-[2px] bg-dark-border/40 z-0" />
            {steps.map((step, i) => (
              <div key={i} className={`flex items-center gap-4 relative z-10 ${i < steps.length - 1 ? 'mb-6' : ''}`}>
                <StepIndicator stepIndex={i} />
                <div className="flex-1 flex justify-between items-center">
                  <span className={`font-semibold text-[15px] transition-colors ${currentStep >= i ? (status === 'idle' && currentStep >= 4 ? 'text-green-400 drop-shadow-[0_0_8px_rgba(74,222,128,0.5)]' : 'text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.3)]') : 'text-white/40'}`}>
                    {step.label}
                  </span>
                  {currentStep === i && status === 'loading' && step.hint && (
                    <span className="text-[13px] text-[#4A90E2] drop-shadow-[0_0_5px_rgba(74,144,226,0.5)] animate-pulse">{step.hint}</span>
                  )}
                  {((currentStep > i) || (status === 'idle' && currentStep >= 4)) && (
                    <span className="text-[13px] text-green-400 font-medium">✓ Done</span>
                  )}
                </div>
              </div>
            ))}
          </div>


          {/* Transaction Links Display (Visible immediately once burn hash is present) */}
          {(burnTxHash || receiveTxHash) && (
            <div className="mt-4 flex flex-col gap-1.5 items-center text-xs text-dark-muted bg-dark-bg/50 p-3 rounded-xl border border-dark-border/50">
              {burnTxHash && (
                <div>
                  Burn Tx:{' '}
                  <a
                    href={fromChain?.explorer ? `${fromChain.explorer}/tx/${burnTxHash}` : `https://basescan.org/tx/${burnTxHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-400 hover:underline font-medium"
                  >
                    {burnTxHash.slice(0, 10)}...{burnTxHash.slice(-8)}
                  </a>
                </div>
              )}
              {receiveTxHash && (
                <div>
                  Receive Tx:{' '}
                  <a
                    href={toChain?.explorer ? `${toChain.explorer}/tx/${receiveTxHash}` : `#`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-emerald-400 hover:underline font-medium"
                  >
                    {receiveTxHash.slice(0, 10)}...{receiveTxHash.slice(-8)}
                  </a>
                </div>
              )}
            </div>
          )}

          {/* Rescue Option: Paste previous Hash if user previously closed the window */}
          {!burnTxHash && status === 'idle' && currentStep === 0 && (
            <div className="mt-3 text-center">
              {!showRescueInput ? (
                <button
                  type="button"
                  onClick={() => setShowRescueInput(true)}
                  className="text-[11px] text-blue-400 hover:text-blue-300 underline transition-colors"
                >
                  Burned tokens before? Paste transaction hash to claim
                </button>
              ) : (
                <form onSubmit={handleRescueSubmit} className="mt-2 space-y-2 p-3 bg-white/[0.02] border border-white/5 rounded-2xl">
                  <input
                    type="text"
                    placeholder="Paste burn transaction hash (0x...)"
                    value={rescueHashInput}
                    onChange={(e) => setRescueHashInput(e.target.value)}
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-white/30 focus:outline-none focus:border-blue-400 font-mono"
                  />
                  <div className="flex gap-2">
                    <button
                      type="submit"
                      className="flex-1 py-1.5 bg-[#4A90E2] hover:bg-[#357ABD] text-white text-xs font-semibold rounded-lg transition-all"
                    >
                      Rescue / Claim Tokens
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowRescueInput(false)}
                      className="px-3 py-1.5 bg-white/10 text-white/70 text-xs rounded-lg hover:bg-white/20"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

          {errorMsg && (
            <div className="mt-4 p-4 bg-red-900/30 border border-red-500/50 rounded-2xl text-xs text-red-300 text-center">
              <div className="flex items-center justify-center gap-2 font-medium mb-1">
                <span>⚠️</span>
                <span>{errorMsg}</span>
              </div>
              <div className="flex items-center justify-center gap-3 mt-3">
                <button 
                  onClick={() => { setErrorMsg(''); executeBridge(burnTxHash); }} 
                  className="px-4 py-1.5 bg-[#4A90E2] hover:bg-[#357ABD] text-white rounded-lg font-semibold transition-all shadow-[0_0_10px_rgba(74,144,226,0.4)]"
                >
                  {burnTxHash ? 'Resume Verification' : 'Try Again'}
                </button>
                <button 
                  onClick={handleClose} 
                  className="px-4 py-1.5 bg-white/10 hover:bg-white/20 text-white/80 hover:text-white rounded-lg font-semibold transition-all"
                >
                  Close
                </button>
              </div>
            </div>
          )}

          {currentStep === 4 && status === 'idle' && (
            <button onClick={handleClose} className="w-full mt-4 bg-[#4A90E2] hover:bg-[#357ABD] text-white py-3 rounded-xl font-bold transition-all shadow-[0_0_20px_rgba(74,144,226,0.4)]">
              Completed ✓
            </button>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body
  );
}

// Helper: wait for receipt 
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
        if (statusNum === 0) throw new Error('Transaction reverted on chain.');
        return; // success
      }
    } catch (err) {
      // If it's a revert error, rethrow immediately
      if (err.message?.includes('reverted') || err.message?.includes('revertida')) throw err;
      // Otherwise it's a connectivity error, keep polling
    }
    await new Promise(r => setTimeout(r, 2000));
  }
  throw new Error('Timeout waiting for transaction confirmation.');
}
