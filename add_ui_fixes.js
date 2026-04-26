const fs = require('fs');
let code = fs.readFileSync('src/renderer/src/components/NotesView.tsx', 'utf-8');

// We need to add a state for drag target
code = code.replace(
  '  const [draggedNoteId, setDraggedNoteId] = useState<string | null>(null)',
  '  const [draggedNoteId, setDraggedNoteId] = useState<string | null>(null)\n  const [dragTargetId, setDragTargetId] = useState<string | null>(null)'
);

// We need to update handlers
const dragHandlersStr = `  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDraggedNoteId(id)
    e.dataTransfer.setData('text/plain', id)
    // Make the drag image slightly transparent
    if (e.target instanceof HTMLElement) {
      e.target.style.opacity = '0.5'
    }
  }

  const handleDragOver = (e: React.DragEvent, id: string) => {
    e.preventDefault()
    if (dragTargetId !== id) {
      setDragTargetId(id)
    }
  }
  
  const handleDragLeave = (e: React.DragEvent, id: string) => {
    if (dragTargetId === id) {
      setDragTargetId(null)
    }
  }
  
  const handleDragEnd = (e: React.DragEvent) => {
    if (e.target instanceof HTMLElement) {
      e.target.style.opacity = '1'
    }
    setDraggedNoteId(null)
    setDragTargetId(null)
  }

  const handleDrop = (e: React.DragEvent, dropTargetId: string, itemType: string) => {
    e.preventDefault()
    setDragTargetId(null)
    
    if (itemType === 'project') return
    if (!draggedNoteId || draggedNoteId === dropTargetId) {
      handleDragEnd(e)
      return
    }
    
    const targetNote = notes.find(n => n.id === dropTargetId)
    if (!targetNote) return

    const actualParentId = targetNote.parentId
    const siblings = notes
      .filter(n => n.parentId === actualParentId && n.projectId === targetNote.projectId && n.id !== draggedNoteId)
      .sort((a, b) => ((a.order ?? 0) - (b.order ?? 0)) || ((a.createdAt || a.lastModified) - (b.createdAt || b.lastModified)))
      
    const targetIdx = siblings.findIndex(n => n.id === dropTargetId)
    siblings.splice(targetIdx + 1, 0, notes.find(n => n.id === draggedNoteId)!)
    
    const updatedNotes = siblings.map((sib, index) => ({
      ...sib,
      order: index * 10
    }))
    
    const draggedNote = updatedNotes.find(n => n.id === draggedNoteId)
    if (draggedNote) draggedNote.parentId = actualParentId

    setNotes(prev => prev.map(n => {
      const up = updatedNotes.find(u => u.id === n.id)
      return up ? up : n
    }))

    for (const up of updatedNotes) {
      handleUpdateNote(up.id, { order: up.order, parentId: up.parentId })
    }
    handleDragEnd(e)
  }`;

// Replace the old handlers 
code = code.replace(/const handleDragStart =[\s\S]*?const handleToggleCollapse =/, dragHandlersStr + '\n\n  const handleToggleCollapse =');

// Add inline styles to the list item container for visual drag feedback
const oldDivStr = `                            draggable={true}
                            onDragStart={(e) => handleDragStart(e, note.id)}
                            onDragOver={handleDragOver}
                            onDrop={(e) => handleDrop(e, note.id, 'note')}
                            onClick={() => setActiveNoteId(note.id)}
                            onContextMenu={(e) => {`;

const newDivStr = `                            draggable={true}
                            onDragStart={(e) => handleDragStart(e, note.id)}
                            onDragOver={(e) => handleDragOver(e, note.id)}
                            onDragLeave={(e) => handleDragLeave(e, note.id)}
                            onDragEnd={handleDragEnd}
                            onDrop={(e) => handleDrop(e, note.id, 'note')}
                            onClick={() => setActiveNoteId(note.id)}
                            onContextMenu={(e) => {`;

code = code.replace(oldDivStr, newDivStr);

// We also need to add the visual bottom-border if dragon
const rx = /borderBottom: '1px solid rgba\\(255,255,255,0\.03\\)'/;
code = code.replace(rx, `borderBottom: dragTargetId === note.id ? '2px solid var(--accent)' : '1px solid rgba(255,255,255,0.03)'`);

fs.writeFileSync('src/renderer/src/components/NotesView.tsx', code);
console.log('Appended UI fixes');
