const fs = require('fs');
let code = fs.readFileSync('src/renderer/src/components/NotesView.tsx', 'utf-8');

code = code.replace(
  "e.dataTransfer.setData('text/plain', id)",
  "e.dataTransfer.setData('text/plain', id)\\n    e.dataTransfer.effectAllowed = 'move'"
);

fs.writeFileSync('src/renderer/src/components/NotesView.tsx', code);
console.log('Added effectAllowed');
