const fs = require('fs');
const lines = fs.readFileSync('src/renderer/src/components/NotesView.tsx', 'utf-8').split(/\r?\n/);

for (let i = 1460; i < 1520; i++) {
  if (lines[i] && lines[i].includes("borderBottom: '1px solid rgba(255,255,255,0.03)'")) {
    lines[i] = lines[i].replace(
      "borderBottom: '1px solid rgba(255,255,255,0.03)'",
      "borderBottom: dragTargetId === note.id ? '2px solid var(--accent)' : '1px solid rgba(255,255,255,0.03)'"
    );
    console.log('Fixed borderBottom at line ' + i);
    break;
  }
}

fs.writeFileSync('src/renderer/src/components/NotesView.tsx', lines.join('\n'));
