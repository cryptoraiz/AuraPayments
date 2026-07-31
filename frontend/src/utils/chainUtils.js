export function toRaw(amount, decimals) {
  if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) return null;
  const parts = amount.split('.');
  let intPart = parts[0];
  let fracPart = parts[1] || '';
  if (fracPart.length > decimals) fracPart = fracPart.slice(0, decimals);
  else while (fracPart.length < decimals) fracPart += '0';
  const combined = intPart + fracPart;
  return combined.replace(/^0+(?=\d)/, '');
}

export function toHexValue(value) {
  if (!value) return '0x0';
  const bi = typeof value === 'string' && /^\d+$/.test(value) ? BigInt(value) : 0n;
  return `0x${bi.toString(16)}`;
}

export function arcGasHeadroom(gasLimit) {
  const floor = 4_000_000n;
  const estimate = typeof gasLimit === 'string' && /^\d+$/.test(gasLimit) ? BigInt(gasLimit) * 2n : 0n;
  return `0x${(estimate > floor ? estimate : floor).toString(16)}`;
}

export async function waitForReceipt(hash) {
  for (let i = 0; i < 60; i++) {
    const receipt = await window.ethereum.request({ method: 'eth_getTransactionReceipt', params: [hash] });
    if (receipt) {
      if (receipt.status != null && BigInt(receipt.status) === 0n) throw new Error('Transaction reverted on-chain');
      return;
    }
    await new Promise(r => setTimeout(r, 2000));
  }
  throw new Error('Receipt timeout - transaction not confirmed in 2 minutes');
}
