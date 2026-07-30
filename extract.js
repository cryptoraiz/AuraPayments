const fs = require('fs');
const content = fs.readFileSync('DeFiWidget_medium.txt', 'utf8');
const obj = JSON.parse(content);

let targetStr = '';
if (obj.content) {
    targetStr = obj.content;
} else if (obj.tool_calls) {
    for (const tc of obj.tool_calls) {
        if (tc.args.CodeContent) targetStr = tc.args.CodeContent;
        if (tc.args.ReplacementContent) targetStr = tc.args.ReplacementContent;
    }
}

if (targetStr.includes('The following code has been modified')) {
    const lines = targetStr.split('\n');
    const clean = [];
    let start = false;
    for (let l of lines) {
        if (l.startsWith('1: ')) start = true;
        if (start && !l.includes('The above content does NOT show')) {
            const parts = l.split(': ');
            if (parts.length > 1 && !isNaN(parseInt(parts[0]))) {
                clean.push(parts.slice(1).join(': '));
            } else {
                clean.push('');
            }
        }
    }
    fs.writeFileSync('frontend/src/components/ui/DeFiWidget.jsx', clean.join('\n'));
    console.log('Saved from view_file lines=' + clean.length);
} else {
    fs.writeFileSync('frontend/src/components/ui/DeFiWidget.jsx', targetStr);
    console.log('Saved raw content size=' + targetStr.length);
}
