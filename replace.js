const fs = require('fs');

const path = 'src/renderer/src/components/NotesView.tsx';
let code = fs.readFileSync(path, 'utf-8');

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

code = code.replace(targetStr, replaceStr);

fs.writeFileSync(path, code);
console.log('Replaced successfully.');
