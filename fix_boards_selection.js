const fs = require('fs');
let code = fs.readFileSync('src/renderer/src/components/boards/BoardsView.tsx', 'utf-8');

const targetStr = `      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        background: theme?.boardBg || '#1b1b1b',
        overflow: 'hidden',
        cursor: isGrabbing`;

const replaceStr = `      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        background: theme?.boardBg || '#1b1b1b',
        overflow: 'hidden',
        userSelect: 'none',
        cursor: isGrabbing`;

code = code.replace(targetStr, replaceStr);

fs.writeFileSync('src/renderer/src/components/boards/BoardsView.tsx', code);
console.log('Fixed selection leak in boardsview');
