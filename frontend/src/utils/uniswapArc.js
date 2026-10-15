import { ethers } from 'ethers';
import {
  UNISWAP_V3_ROUTER_ARC,
  UNISWAP_V3_QUOTER_ARC,
} from '../config/constants';
import { ERC20_ABI } from './abis';

const ARC_RPC_URLS = [
  'https://5042.rpc.thirdweb.com',
  'https://rpc.mainnet.arc.io'
];

let _cachedProvider = null;
function getProvider() {
  if (!_cachedProvider) {
    _cachedProvider = new ethers.JsonRpcProvider(ARC_RPC_URLS[0]);
  }
  return _cachedProvider;
}

const quoteCache = new Map();
const CACHE_TTL_MS = 15_000;

function encodePath(tokens, fees) {
  let path = '0x';
  for (let i = 0; i < fees.length; i++) {
    path += tokens[i].slice(2).toLowerCase();
    path += fees[i].toString(16).padStart(6, '0');
  }
  path += tokens[tokens.length - 1].slice(2).toLowerCase();
  return path;
}

/**
 * Fetch direct on-chain quote from Uniswap V3 Quoter on Arc Mainnet
 * Supports single-pool direct quotes and multi-hop routing via USDC
 */
export async function fetchUniswapArcQuote({ tokenIn, tokenOut, amountInRaw, slippage = 0.5 }) {
  if (!tokenIn?.address || !tokenOut?.address || !amountInRaw) return null;

  try {
    const tokenInAddr = ethers.getAddress(tokenIn.address);
    const tokenOutAddr = ethers.getAddress(tokenOut.address);
    const rawIn = BigInt(amountInRaw);

    if (rawIn <= 0n) return null;

    // Fast Cache Check (15s TTL)
    const cacheKey = `${tokenInAddr}_${tokenOutAddr}_${rawIn.toString()}`;
    const cached = quoteCache.get(cacheKey);
    if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
      return cached.data;
    }

    const provider = getProvider();
    const quoterContract = new ethers.Contract(UNISWAP_V3_QUOTER_ARC, QUOTER_ABI, provider);

    // 1. Single-hop: check all standard fee tiers in parallel (0.01%, 0.05%, 0.3%, 1%)
    const feeTiers = [500, 3000, 100, 10000];
    const quotePromises = feeTiers.map(async (fee) => {
      try {
        const res = await quoterContract.quoteExactInputSingle.staticCall({
          tokenIn: tokenInAddr,
          tokenOut: tokenOutAddr,
          amountIn: rawIn,
          fee,
          sqrtPriceLimitX96: 0
        });
        const rawOut = res?.[0];
        if (rawOut && rawOut > 0n) {
          return { fee, rawOut };
        }
        return null;
      } catch {
        return null;
      }
    });

    const results = await Promise.all(quotePromises);
    const validQuotes = results.filter(Boolean);

    if (validQuotes.length > 0) {
      validQuotes.sort((a, b) => (b.rawOut > a.rawOut ? 1 : -1));
      const best = validQuotes[0];

      const decimals = tokenOut.decimals || 6;
      const maxDec = decimals <= 6 ? 4 : 8;
      const formatted = parseFloat((Number(best.rawOut) / (10 ** decimals)).toFixed(maxDec)).toString();

      const quoteResult = {
        success: true,
        amountOutRaw: best.rawOut.toString(),
        amountOutFormatted: formatted,
        fee: best.fee,
        priceImpact: (best.fee / 10000).toFixed(2),
        routeString: `Uniswap V3 (${best.fee / 10000}%)`,
        provider: 'uniswap',
        isMultihop: false
      };
      quoteCache.set(cacheKey, { data: quoteResult, ts: Date.now() });
      return quoteResult;
    }

    // 2. Multi-hop: route via USDC if no direct pool exists (parallel evaluation)
    const usdcAddr = ethers.getAddress(USDC_ARC);
    if (tokenInAddr !== usdcAddr && tokenOutAddr !== usdcAddr) {
      const hopFeeCombos = [
        [500, 100],
        [100, 500],
        [500, 10000],
        [10000, 500],
        [3000, 100],
        [100, 3000],
        [500, 500]
      ];

      const hopPromises = hopFeeCombos.map(async (fees) => {
        try {
          const path = encodePath([tokenInAddr, usdcAddr, tokenOutAddr], fees);
          const res = await quoterContract.quoteExactInput.staticCall(path, rawIn);
          const rawOut = res?.[0];
          if (rawOut && rawOut > 0n) {
            return { fees, path, rawOut };
          }
          return null;
        } catch {
          return null;
        }
      });

      const hopResults = await Promise.all(hopPromises);
      const validHops = hopResults.filter(Boolean);

      if (validHops.length > 0) {
        validHops.sort((a, b) => (b.rawOut > a.rawOut ? 1 : -1));
        const bestHop = validHops[0];
        const decimals = tokenOut.decimals || 6;
        const maxDec = decimals <= 6 ? 4 : 8;
        const formatted = parseFloat((Number(bestHop.rawOut) / (10 ** decimals)).toFixed(maxDec)).toString();
        const hopQuote = {
          success: true,
          amountOutRaw: bestHop.rawOut.toString(),
          amountOutFormatted: formatted,
          path: bestHop.path,
          priceImpact: ((bestHop.fees[0] + bestHop.fees[1]) / 10000).toFixed(2),
          routeString: 'Uniswap V3 (Multi-hop via USDC)',
          provider: 'uniswap',
          isMultihop: true
        };
        quoteCache.set(cacheKey, { data: hopQuote, ts: Date.now() });
        return hopQuote;
      }
    }

    return null;
  } catch (err) {
    console.warn('[fetchUniswapArcQuote Error]', err);
    return null;
  }
}

/**
 * Check if the user has approved enough token allowance for Uniswap Router
 */
export async function getUniswapAllowance(tokenAddress, ownerAddress) {
  if (!tokenAddress || !ownerAddress) return 0n;
  try {
    const provider = getProvider();
    const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
    const allowance = await tokenContract.allowance(ownerAddress, UNISWAP_V3_ROUTER_ARC);
    return BigInt(allowance.toString());
  } catch {
    return 0n;
  }
}

/**
 * Build approve transaction for Uniswap Router
 */
export function buildUniswapApproveTx(tokenAddress, amountRaw) {
  const iface = new ethers.Interface(ERC20_ABI);
  // Default to max uint256 or exact amount
  const data = iface.encodeFunctionData('approve', [
    UNISWAP_V3_ROUTER_ARC,
    amountRaw ? BigInt(amountRaw) : ethers.MaxUint256
  ]);
  return {
    to: tokenAddress,
    data,
    value: '0x0'
  };
}

/**
 * Build swap transaction calldata for SwapRouter02 on Arc Mainnet
 */
export function buildUniswapSwapTx({
  tokenInAddress,
  tokenOutAddress,
  fee = 500,
  recipient,
  amountInRaw,
  amountOutRaw,
  slippage = 0.5,
  path,
  isMultihop = false
}) {
  const iface = new ethers.Interface(SWAP_ROUTER_ABI);
  const rawIn = BigInt(amountInRaw);
  let minOut = 0n;

  if (amountOutRaw) {
    const rawOut = BigInt(amountOutRaw);
    const slippageBps = BigInt(Math.floor(Number(slippage || 0.5) * 100));
    minOut = (rawOut * (10000n - slippageBps)) / 10000n;
  }

  let data;
  if (isMultihop && path) {
    data = iface.encodeFunctionData('exactInput', [{
      path,
      recipient: ethers.getAddress(recipient),
      amountIn: rawIn,
      amountOutMinimum: minOut
    }]);
  } else {
    data = iface.encodeFunctionData('exactInputSingle', [{
      tokenIn: ethers.getAddress(tokenInAddress),
      tokenOut: ethers.getAddress(tokenOutAddress),
      fee: Number(fee || 500),
      recipient: ethers.getAddress(recipient),
      amountIn: rawIn,
      amountOutMinimum: minOut,
      sqrtPriceLimitX96: 0
    }]);
  }

  return {
    to: UNISWAP_V3_ROUTER_ARC,
    data,
    value: '0x0'
  };
}
