const fs = require('fs');
let content = fs.readFileSync('frontend/src/pages/ProfilePage.jsx', 'utf8');

content = content.replace(
  'className="flex-1 flex flex-col items-center justify-start pt-4 pb-4 w-full"',
  'className="flex-1 flex flex-col items-center justify-start py-4 w-full min-h-0"'
);

content = content.replace(
  '<div className="w-full max-w-7xl mx-auto px-6 space-y-4 relative z-20">',
  '<div className="w-full max-w-7xl mx-auto px-4 md:px-6 flex flex-col h-full min-h-0 gap-4 relative z-20">'
);

content = content.replace(
  '<div className="bg-dark-card border border-dark-border rounded-3xl p-4 shadow-2xl relative overflow-hidden flex flex-col md:flex-row items-center justify-between gap-4">',
  '<div className="bg-dark-card border border-dark-border rounded-3xl p-4 shadow-2xl relative overflow-hidden flex flex-col md:flex-row items-center justify-between gap-4 shrink-0">'
);

content = content.replace(
  '<div className="flex items-center gap-1 bg-dark-input p-1 rounded-2xl border border-dark-border/50 w-full max-w-sm">',
  '<div className="flex items-center gap-1 bg-dark-input p-1 rounded-2xl border border-dark-border/50 w-full max-w-sm shrink-0">'
);

content = content.replace(
  '<div className="grid w-full place-items-start">',
  '<div className="grid w-full flex-1 min-h-0 relative">'
);

content = content.replaceAll(
  'bg-dark-card border border-dark-border rounded-3xl overflow-hidden shadow-2xl flex-col h-[650px] md:h-[540px]',
  'bg-dark-card border border-dark-border rounded-3xl overflow-hidden shadow-2xl flex-col h-full absolute inset-0'
);

fs.writeFileSync('frontend/src/pages/ProfilePage.jsx', content, 'utf8');
console.log('ProfilePage fixed!');
