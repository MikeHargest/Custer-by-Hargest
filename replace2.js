const fs = require('fs');
let code = fs.readFileSync('src/renderer/src/components/NotesView.tsx', 'utf-8');

const target = '                          <div\\n                            onClick={() => setActiveNoteId(note.id)}\\n                            onContextMenu={(e) => {';

// actually we can just regex the exact text
code = code.replace(
  /<div\\s+onClick=\\{\\(\\) => setActiveNoteId\\(note\\.id\\)\\}\\s+onContextMenu=\\{\\(e\\) => \\{/,
  '<div\\n                            draggable={true}\\n                            onDragStart={(e) => handleDragStart(e, note.id)}\\n                            onDragOver={handleDragOver}\\n                            onDrop={(e) => handleDrop(e, note.id, \\'note\\')}\\n                            onClick={() => setActiveNoteId(note.id)}\\n                            onContextMenu={(e) => {'
);

fs.writeFileSync('src/renderer/src/components/NotesView.tsx', code);
console.log('replaced');
