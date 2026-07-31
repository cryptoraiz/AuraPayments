const fs = require('fs');
const path = require('path');

function walkDir(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(file => {
        file = path.join(dir, file);
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory()) {
            results = results.concat(walkDir(file));
        } else if (file.endsWith('.js') || file.endsWith('.jsx')) {
            results.push(file);
        }
    });
    return results;
}

const files = walkDir('frontend/src');
let changedFiles = 0;

files.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');
    let originalContent = content;
    
    content = content.split('\n').map(line => {
        // If line contains multiple dashes/equals in a row (e.g. ─── or ====)
        if (line.includes('──') || line.includes('==') || line.includes('__')) {
            // Only affect comment lines to be safe
            if (line.trim().startsWith('//') || line.trim().startsWith('{/*')) {
                // Strip out the weird characters
                let cleaned = line.replace(/[─=_]/g, '');
                // Clean up multiple spaces inside the comment but preserve leading whitespace
                let match = cleaned.match(/^(\s*)(.*)/);
                if (match) {
                    cleaned = match[1] + match[2].replace(/\s{2,}/g, ' ');
                }
                return cleaned;
            }
        }
        
        // Also replace em-dashes (—) with standard hyphens (-)
        if (line.includes('—')) {
            line = line.replace(/—/g, '-');
        }
        
        // Also replace any lingering '─' just in case
        if (line.includes('─')) {
            line = line.replace(/─/g, '-');
        }
        
        return line;
    }).join('\n');
    
    if (content !== originalContent) {
        fs.writeFileSync(file, content);
        console.log('Cleaned:', file);
        changedFiles++;
    }
});

console.log(`Finished cleaning ${changedFiles} files.`);
