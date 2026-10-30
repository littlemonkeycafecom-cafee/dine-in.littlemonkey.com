import fs from 'fs';

const content = fs.readFileSync('C:/Users/chava/.gemini/antigravity-ide/scratch/ordering system/src/components/SystemControl.jsx', 'utf8');
const idx = content.indexOf("activeTab === 'SETTINGS' &&");
console.log(content.slice(idx, idx + 2500));
