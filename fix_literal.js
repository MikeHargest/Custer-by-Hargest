const fs = require('fs');
let code = fs.readFileSync('src/renderer/src/components/NotesView.tsx', 'utf-8');
code = code.replace("id)\\n    e.dataTransfer", "id)\n    e.dataTransfer");
fs.writeFileSync('src/renderer/src/components/NotesView.tsx', code);
console.log('Fixed literal backslash n');
