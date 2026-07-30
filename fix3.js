const fs = require('fs');
const path = require('path');

// 1. SwapModal.jsx
const swapModalPath = path.join(__dirname, 'frontend/src/components/ui/SwapModal.jsx');
let swapModal = fs.readFileSync(swapModalPath, 'utf8');

// Inside handleApprove or handleExecute, or rather in `onComplete` or success state
// Wait, the success state is reached when `currentStep === 4`. 
// The actual execution happens in `useEffect` when `currentStep === 3`.
if (!swapModal.includes("localStorage.setItem('arc_activities'")) {
  swapModal = swapModal.replace(
    /setTxHash\(receipt\.transactionHash\);\s+setCurrentStep\(4\);/,
    `setTxHash(receipt.transactionHash);
        setCurrentStep(4);
        
        // Save Activity
        try {
          const acts = JSON.parse(localStorage.getItem('arc_activities') || '[]');
          acts.unshift({
            type: 'Swap',
            details: \`\${amount} \${tokenIn?.symbol} -> \${outputAmount} \${tokenOut?.symbol}\`,
            time: new Date().toLocaleString(),
            status: 'Completed',
            chain: 'Arc Testnet',
            hash: receipt.transactionHash,
            wallet: userAddress
          });
          localStorage.setItem('arc_activities', JSON.stringify(acts));
        } catch(e) {}`
  );
  fs.writeFileSync(swapModalPath, swapModal, 'utf8');
}

// 2. BridgeModal.jsx
const bridgeModalPath = path.join(__dirname, 'frontend/src/components/ui/BridgeModal.jsx');
let bridgeModal = fs.readFileSync(bridgeModalPath, 'utf8');
if (!bridgeModal.includes("localStorage.setItem('arc_activities'")) {
  bridgeModal = bridgeModal.replace(
    /setTxHash\(receipt\.transactionHash\);\s+setCurrentStep\(4\);/,
    `setTxHash(receipt.transactionHash);
        setCurrentStep(4);

        // Save Activity
        try {
          const acts = JSON.parse(localStorage.getItem('arc_activities') || '[]');
          acts.unshift({
            type: 'Bridge',
            details: \`\${amount} \${token?.symbol} (\${fromChain?.name}) -> \${toChain?.name}\`,
            time: new Date().toLocaleString(),
            status: 'Completed',
            chain: \`\${fromChain?.name} -> \${toChain?.name}\`,
            hash: receipt.transactionHash,
            wallet: userAddress
          });
          localStorage.setItem('arc_activities', JSON.stringify(acts));
        } catch(e) {}`
  );
  fs.writeFileSync(bridgeModalPath, bridgeModal, 'utf8');
}

// 3. ProfilePage.jsx
const profilePagePath = path.join(__dirname, 'frontend/src/pages/ProfilePage.jsx');
let profilePage = fs.readFileSync(profilePagePath, 'utf8');

// Load activities from localStorage, and load assets dynamically based on real tokens
// We need to fetch balances for real tokens. But wait, we can just use wagmi's `useBalance` for a selected set of tokens, 
// OR just read the `tokens` array and render an `AssetRow` for each. Since hooks can't be in loops easily without components, 
// I will create an `AssetRow` component inside ProfilePage.jsx

if (!profilePage.includes('function AssetRow')) {
  // Add AssetRow definition
  const assetRowDef = `
function AssetRow({ token, address }) {
  const { data: balanceData } = useBalance({
    address: address,
    token: token.isNative ? undefined : token.address,
    chainId: token.chainId || 5042002,
  });

  if (!balanceData || Number(balanceData.formatted) <= 0) return null;
  const balance = Number(balanceData.formatted).toFixed(4);

  return (
    <div className="grid grid-cols-4 items-center px-6 py-4 border-b border-dark-border/30 hover:bg-dark-input/30 transition-colors cursor-pointer group">
      <div className="col-span-2 flex items-center gap-4">
        <div className={\`w-10 h-10 rounded-full \${token.color || 'bg-gray-700'} flex items-center justify-center text-white shadow-lg group-hover:scale-110 transition-transform overflow-hidden p-[2px] bg-dark-bg/20\`}>
          {token.iconImg ? (
            <img src={token.iconImg} alt={token.symbol} className="w-full h-full object-contain rounded-full" />
          ) : (
            <span className="text-xs font-bold">{token.symbol.slice(0, 2)}</span>
          )}
        </div>
        <div>
          <div className="font-bold text-white text-base">{token.symbol}</div>
          <div className="text-xs text-dark-muted">{token.name}</div>
        </div>
      </div>
      <div className="col-span-1 text-right text-sm text-dark-muted font-medium">
        {balance}
      </div>
      <div className="col-span-1 text-right pr-2">
        <div className="font-bold text-white">--</div>
      </div>
    </div>
  );
}
`;

  profilePage = profilePage.replace(
    /import \{ useAccount \} from 'wagmi';/,
    `import { useAccount, useBalance } from 'wagmi';\nimport { getAllTokens } from '../config/tokens';`
  );
  
  profilePage = profilePage + '\n' + assetRowDef;
}

// Modify the Assets render block
profilePage = profilePage.replace(
  /const assets = \[\];/,
  `const assets = getAllTokens();`
);
profilePage = profilePage.replace(
  /const paginatedAssets = \[\];/, 
  ''
);

// We need to replace the static asset rendering with the new AssetRow component mapping over tokens
const assetRenderStart = profilePage.indexOf('{paginatedAssets.length === 0 ? <div className="p-6 text-center text-dark-muted">No assets found</div> : paginatedAssets.map((asset, idx) => (');
if (assetRenderStart !== -1) {
  const assetRenderEnd = profilePage.indexOf('))}');
  // It's a bit tricky to replace exactly. I'll use regex.
}

// Let's use regex to replace the asset list
profilePage = profilePage.replace(
  /\{paginatedAssets\.length === 0 \? [\s\S]*?\)\)\}/,
  `{assets.map((token, idx) => <AssetRow key={idx} token={token} address={address} />)}`
);
// Remove Asset Pagination controls
profilePage = profilePage.replace(/\{totalAssetPages > 1 && \([\s\S]*?\}\)/, '');


// Modify the Activities block to load from localStorage
profilePage = profilePage.replace(
  /const activities = \[\];/,
  `const activities = JSON.parse(localStorage.getItem('arc_activities') || '[]').filter(a => a.wallet === address);`
);

// Replace activity empty check
profilePage = profilePage.replace(
  /\{paginatedActivities\.length === 0 \? <div className="p-6 text-center text-dark-muted">No activities found<\/div> : paginatedActivities\.map\(\(act, idx\) => \(/,
  `{paginatedActivities.length === 0 ? <div className="p-6 text-center text-dark-muted">No recent activities found for this wallet</div> : paginatedActivities.map((act, idx) => (`
);

fs.writeFileSync(profilePagePath, profilePage, 'utf8');
console.log('fix3 done');
