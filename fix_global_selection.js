const fs = require('fs');
let css = fs.readFileSync('src/renderer/src/assets/main.css', 'utf-8');

if (!css.includes('user-select: none;')) {
  css = css.replace(
    /body \\{\\s+font-family:/,
    'body {\\n  user-select: none;\\n  -webkit-user-select: none;\\n  font-family:'
  );
  
  // adding explicit user-select to tiptap if not present
  css += '\\n\\n.tiptap-editor, input, textarea {\\n  user-select: text;\\n  -webkit-user-select: text;\\n}\\n';
  
  fs.writeFileSync('src/renderer/src/assets/main.css', css);
  console.log('Added global user-select none to body');
} else {
  console.log('user-select none already exists');
}
