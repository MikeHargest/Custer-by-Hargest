const fs = require('fs');
let css = fs.readFileSync('src/renderer/src/assets/main.css', 'utf-8');

if (!css.includes('user-select: none')) {
  css = css.replace(
    /\\*\\s*\\{/,
    '* {\\n  user-select: none !important;\\n  -webkit-user-select: none !important;'
  );
  
  css += '\\n\\n.tiptap-editor, .tiptap-editor *, input, textarea {\\n  user-select: text !important;\\n  -webkit-user-select: text !important;\\n}\\n';
  fs.writeFileSync('src/renderer/src/assets/main.css', css);
  console.log('Successfully enforced user-select none');
} else {
  console.log('Already enforced');
}
