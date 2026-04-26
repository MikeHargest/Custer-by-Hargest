const fs = require('fs');
let css = fs.readFileSync('src/renderer/src/assets/main.css', 'utf-8');

css = css.replace(
  /\\* \\{\\s+margin: 0;/g,
  '* {\\n  user-select: none !important;\\n  -webkit-user-select: none !important;\\n  margin: 0;'
);
  
css += '\\n\\n.tiptap-editor, .tiptap-editor *, input, textarea {\\n  user-select: text !important;\\n  -webkit-user-select: text !important;\\n}\\n';

fs.writeFileSync('src/renderer/src/assets/main.css', css);
console.log('Force bypassed check');
