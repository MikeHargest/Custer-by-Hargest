import React from 'react'

interface DropZoneProps {
  dzAction: string
  dzProject: string
  dzTask?: string
}

const DropZone: React.FC<DropZoneProps> = ({ dzAction, dzProject, dzTask }) => {
  return (
    <div
      data-dropzone="true"
      data-dz-action={dzAction}
      data-dz-project={dzProject}
      data-dz-task={dzTask || ''}
      style={{
        height: '10px',
        margin: '-5px 0',
        position: 'relative',
        zIndex: 100
      }}
    />
  )
}

export default DropZone
