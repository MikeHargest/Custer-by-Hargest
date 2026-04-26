const fs = require('fs');
const lines = fs.readFileSync('src/renderer/src/components/NotesView.tsx', 'utf-8').split(/\r?\n/);
for(let i=0; i<lines.length; i++) {
  if (lines[i].includes('onClick={() => setActiveNoteId(note.id)}')) {
    lines[i] = '                            draggable={true}\n' +
               '                            onDragStart={(e) => handleDragStart(e, note.id)}\n' +
               '                            onDragOver={handleDragOver}\n' +
               '                            onDrop={(e) => handleDrop(e, note.id, \'note\')}\n' +
               lines[i];
    break;
  }
}
fs.writeFileSync('src/renderer/src/components/NotesView.tsx', lines.join('\n'));
console.log('Successfully added DND props via line replacement.');
