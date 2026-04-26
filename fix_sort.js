const fs = require('fs');
let code = fs.readFileSync('src/renderer/src/components/NotesView.tsx', 'utf-8');

// The replacement sort function logic:
const newSortCode = `.sort((a, b) => {
          const diff = (a.order ?? 0) - (b.order ?? 0);
          if (diff !== 0) return diff;
          const aTime = a.createdAt || a.id.charCodeAt(0);
          const bTime = b.createdAt || b.id.charCodeAt(0);
          if (aTime !== bTime) return aTime - bTime;
          return a.id.localeCompare(b.id);
        })`;

code = code.replace(/\.sort\(\(a, b\) => \(\(a\.order \?\? 0\) - \(b\.order \?\? 0\)\) \|\| \(\(a\.createdAt \|\| a\.lastModified\) - \(b\.createdAt \|\| b\.lastModified\)\)\)/g, newSortCode);

fs.writeFileSync('src/renderer/src/components/NotesView.tsx', code);
console.log('Fixed jumping sort');
