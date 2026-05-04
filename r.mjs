import fs from 'fs'
const f = 'src/renderer/src/components/SettingsModal.tsx'
let c = fs.readFileSync(f, 'utf-8')

// Remove sidebar background and border
c = c.replace(
  "background: 'rgba(0,0,0,0.15)',\r\n              borderRight: '1px solid rgba(255,255,255,0.05)',",
  "background: 'transparent',\r\n              borderRight: '1px solid rgba(255,255,255,0.05)',"
)

// Remove footer background
c = c.replace(
  "background: 'rgba(0,0,0,0.2)',\r\n            borderTop:",
  "background: 'transparent',\r\n            borderTop:"
)

// Remove header bottom border background (keep just the border)
// Also remove rgba(0,0,0,0.2) from the top "header" section if present

fs.writeFileSync(f, c)
console.log('OK')
