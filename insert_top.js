const fs = require('fs');
let css = fs.readFileSync('src/renderer/src/assets/main.css', 'utf-8');

css = css.replace(
  ':root {',
  '* {\\n  user-select: none !important;\\n  -webkit-user-select: none !important;\\n}\\n\\n.tiptap-editor, .tiptap-editor *, input, textarea {\\n  user-select: text !important;\\n  -webkit-user-select: text !important;\\n}\\n\\n:root {'
);

fs.writeFileSync('src/renderer/src/assets/main.css', css);
console.log('Appended to top of file directly');
