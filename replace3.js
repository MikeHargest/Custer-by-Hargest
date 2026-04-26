const fs = require('fs');
let code = fs.readFileSync('src/renderer/src/components/NotesView.tsx', 'utf-8');

const targetStr = `                          <div
                            onClick={() => setActiveNoteId(note.id)}
                            onContextMenu={(e) => {`;

const replaceStr = `                          <div
                            draggable={true}
                            onDragStart={(e) => handleDragStart(e, note.id)}
                            onDragOver={handleDragOver}
                            onDrop={(e) => handleDrop(e, note.id, 'note')}
                            onClick={() => setActiveNoteId(note.id)}
                            onContextMenu={(e) => {`;

if (code.includes(targetStr)) {
  code = code.replace(targetStr, replaceStr);
  fs.writeFileSync('src/renderer/src/components/NotesView.tsx', code);
  console.log('Replaced via exact match');
} else {
  // Try regex
  const regex = /<div\\s+onClick=\\{\\(\\) => setActiveNoteId\\(note\\.id\\)\\}\\s+onContextMenu=\\{\\(e\\) => \\{/;
  code = code.replace(regex, replaceStr);
  fs.writeFileSync('src/renderer/src/components/NotesView.tsx', code);
  console.log('Replaced via regex');
}
