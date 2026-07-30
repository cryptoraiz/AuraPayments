const fs = require('fs');
const path = require('path');

// 1. DeFiWidget.jsx
const defiwidPath = path.join(__dirname, 'frontend/src/components/ui/DeFiWidget.jsx');
let defiwid = fs.readFileSync(defiwidPath, 'utf8');

// Bridge auto-flip
defiwid = defiwid.replace(
  `  const handleBridgeSelection = (selection) => {
    if (selectingFor === 'in') {
      setBridgeChainIn(selection.chain);
      setBridgeTokenIn(selection.token);
    } else {
      setBridgeChainOut(selection.chain);
      setBridgeTokenOut(selection.token);
    }
    setQuote(null);
  };`,
  `  const handleBridgeSelection = (selection) => {
    if (selectingFor === 'in') {
      if (selection.chain.id === bridgeChainOut.id) {
         setBridgeChainOut(bridgeChainIn);
         setBridgeTokenOut(bridgeTokenIn);
      }
      setBridgeChainIn(selection.chain);
      setBridgeTokenIn(selection.token);
    } else {
      if (selection.chain.id === bridgeChainIn.id) {
         setBridgeChainIn(bridgeChainOut);
         setBridgeTokenIn(bridgeTokenOut);
      }
      setBridgeChainOut(selection.chain);
      setBridgeTokenOut(selection.token);
    }
    setQuote(null);
  };`
);

// Add useNavigate
if (!defiwid.includes('useNavigate')) {
  defiwid = defiwid.replace(/import { useState, useEffect, useCallback } from 'react';/, `import { useState, useEffect, useCallback } from 'react';\nimport { useNavigate } from 'react-router-dom';`);
  defiwid = defiwid.replace(/const { address }   = useAccount\(\);/, `const { address }   = useAccount();\n  const navigate = useNavigate();`);
}

// History and Settings buttons
defiwid = defiwid.replace(
  `<button onClick={fetchQuote} title="Refresh quote"`,
  `<button onClick={() => navigate('/activity')} title="History"`
);
defiwid = defiwid.replace(
  `<button className="w-9 h-9 flex items-center justify-center rounded-full bg-dark-bg text-dark-muted hover:text-white hover:bg-dark-border transition-all">`,
  `<button onClick={() => alert('Slippage is auto-optimized for Arc Testnet (0.5%).')} title="Settings" className="w-9 h-9 flex items-center justify-center rounded-full bg-dark-bg text-dark-muted hover:text-white hover:bg-dark-border transition-all">`
);

fs.writeFileSync(defiwidPath, defiwid, 'utf8');

// 2. ArcAIPage.jsx
const arcaiPath = path.join(__dirname, 'frontend/src/pages/ArcAIPage.jsx');
let arcai = fs.readFileSync(arcaiPath, 'utf8');
arcai = arcai.replace(/Arc Terminal/g, 'Aura Terminal');
arcai = arcai.replace(/Arc AI Core/g, 'Aura AI Core');
fs.writeFileSync(arcaiPath, arcai, 'utf8');

console.log('fix2 part 1 done');
