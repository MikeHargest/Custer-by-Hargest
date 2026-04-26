const fs = require('fs');

const path = 'src/renderer/src/components/NotesView.tsx';
let code = fs.readFileSync(path, 'utf-8');

const targetStr = `  const handleToggleCollapse = (noteId: string, e: React.MouseEvent): void => {`;

const replaceStr = `  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDraggedNoteId(id)
    e.dataTransfer.setData('text/plain', id)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
  }

  const handleDrop = (e: React.DragEvent, dropTargetId: string, itemType: string) => {
    e.preventDefault()
    if (itemType === 'project') return
    if (!draggedNoteId || draggedNoteId === dropTargetId) return
    
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
    setDraggedNoteId(null)
  }

  const handleToggleCollapse = (noteId: string, e: React.MouseEvent): void => {`;

code = code.replace(targetStr, replaceStr);

fs.writeFileSync(path, code);
console.log('Functions inserted successfully.');
