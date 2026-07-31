const fs = require('fs');
const file = 'frontend/src/components/ui/BridgeModal.jsx';
let content = fs.readFileSync(file, 'utf8');

// Replacement 1: StepIndicator glow
content = content.replace(
    'if (isDone) return (\n      <div className="w-5 h-5 rounded-full bg-[#4A90E2] border-2 border-[#4A90E2] flex items-center justify-center shrink-0">',
    'if (isDone) return (\n      <div className="w-5 h-5 rounded-full bg-[#4A90E2] border-2 border-[#4A90E2] flex items-center justify-center shrink-0 shadow-[0_0_12px_rgba(74,144,226,0.6)]">'
);
content = content.replace(
    'if (isLoading) return <div className="w-5 h-5 rounded-full border-2 border-[#4A90E2] border-t-transparent animate-spin shrink-0" />;',
    'if (isLoading) return <div className="w-5 h-5 rounded-full border-2 border-[#4A90E2] border-t-transparent animate-spin shrink-0 shadow-[0_0_12px_rgba(74,144,226,0.6)]" />;'
);
content = content.replace(
    'return <div className={`w-5 h-5 rounded-full border-2 shrink-0 ${isActive ? \'border-[#4A90E2] bg-[#4A90E2]/20\' : \'border-dark-border bg-dark-bg\'}`} />;',
    'return <div className={`w-5 h-5 rounded-full border-2 shrink-0 transition-all ${isActive ? \'border-[#4A90E2] bg-[#4A90E2]/20 shadow-[0_0_12px_rgba(74,144,226,0.4)]\' : \'border-dark-border bg-transparent\'}`} />;'
);

// Replacement 2: Modal Container
content = content.replace(
    'className="bg-[#1C1C1E] border border-dark-border rounded-[32px] w-full max-w-[420px] shadow-2xl overflow-hidden p-6 relative"',
    'className="bg-[#111214]/85 backdrop-blur-3xl border border-white/10 rounded-[32px] w-full max-w-[420px] shadow-[0_0_50px_rgba(0,0,0,0.8)] overflow-hidden p-6 relative"'
);

// Replacement 3: Steps Container
content = content.replace(
    '<div className="bg-transparent border border-dark-border/60 rounded-3xl p-5 relative">',
    '<div className="bg-white/[0.02] border border-white/5 shadow-[0_0_20px_rgba(0,0,0,0.3)] backdrop-blur-xl rounded-3xl p-5 relative">'
);

// Replacement 4: Active step text glow
content = content.replace(
    '<span className={`font-semibold text-[15px] ${currentStep >= i ? (i === 4 ? \'text-green-400\' : \'text-white\') : \'text-dark-muted\'}`}>',
    '<span className={`font-semibold text-[15px] transition-colors ${currentStep >= i ? (i === 4 ? \'text-green-400 drop-shadow-[0_0_8px_rgba(74,222,128,0.5)]\' : \'text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.3)]\') : \'text-white/40\'}`}>'
);

// Replacement 5: Active step hint pulse
content = content.replace(
    '<span className="text-[13px] text-[#4A90E2]">{step.hint}</span>',
    '<span className="text-[13px] text-[#4A90E2] drop-shadow-[0_0_5px_rgba(74,144,226,0.5)] animate-pulse">{step.hint}</span>'
);

fs.writeFileSync(file, content);
console.log('UI updated successfully via script.');
