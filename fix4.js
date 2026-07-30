const fs = require('fs');
const path = require('path');

const profilePagePath = path.join(__dirname, 'frontend/src/pages/ProfilePage.jsx');
let content = fs.readFileSync(profilePagePath, 'utf8');

// Add AssetRow component and imports
if (!content.includes('function AssetRow')) {
  content = content.replace(
    /import \{ useAccount \} from 'wagmi';/,
    `import { useAccount, useBalance } from 'wagmi';\nimport { getAllTokens } from '../config/tokens';`
  );
  
  content += `\n
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
}

// Fix Assets data to be all tokens
content = content.replace(
  /const assets = \[[\s\S]*?\];/,
  `const assets = getAllTokens();`
);

// Fix Activities data to read from localStorage
content = content.replace(
  /const activities = \[[\s\S]*?\];/,
  `const activities = JSON.parse(localStorage.getItem('arc_activities') || '[]').filter(a => a.wallet === address);`
);

// We need to replace the asset rendering logic (paginatedAssets.map...)
// First, find where {paginatedAssets.map is and replace that loop up to ))}
const assetListStartStr = '{paginatedAssets.map((asset, idx) => (';
const replaceStr = `{assets.map((token, idx) => <AssetRow key={idx} token={token} address={address} />)}`;

// Actually, in the reverted code, it looks like this:
// {paginatedAssets.map((asset, idx) => (
//   <div key={idx} className="grid grid-cols-4 items-center px-6 py-4 border-b border-dark-border/30 hover:bg-dark-input/30 transition-colors cursor-pointer group">
// ...
//   </div>
// ))}

content = content.replace(
  /\{paginatedAssets\.map\(\(asset, idx\) => \([\s\S]*?\}\)\)\}/,
  replaceStr
);

// Activities empty state and map
content = content.replace(
  /\{paginatedActivities\.map\(\(act, idx\) => \(/,
  `{paginatedActivities.length === 0 ? <div className="p-6 text-center text-dark-muted">No recent activities found for this wallet</div> : paginatedActivities.map((act, idx) => (`
);

// Total Balance -> "$0.00" for now
content = content.replace(
  /const totalBalance = "[^"]+";/,
  `const totalBalance = "$0.00";`
);

// Remove the white circle p-[1px] from activities or assets if any remaining
content = content.replace(/bg-white p-\[1px\]/g, '');

fs.writeFileSync(profilePagePath, content, 'utf8');
console.log('fix4 done');
