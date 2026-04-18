import { useState } from 'react'
import { Bell, BellOff, X, Calendar, Clock } from 'lucide-react'
import type { AlarmData, UITheme } from '../types'

interface AlarmCardProps {
  data: AlarmData
  theme: UITheme
  onUpdate: (updates: Partial<AlarmData>) => void
  onDelete: () => void
}

export default function AlarmCard({ data, onUpdate, onDelete }: AlarmCardProps) {
  const [isDragOver] = useState(false)


  const clearTask = () => {
    onUpdate({ taskName: null })
  }

  const toggleEnabled = () => {
    onUpdate({ isEnabled: !data.isEnabled, isNotified: false })
  }

  return (
    <div
      className={`timer-card alarm-card ${!data.isEnabled ? 'disabled' : ''} ${data.isNotified ? 'notified' : ''} ${isDragOver ? 'drag-over-alarm' : ''}`}
      data-alarm-id={data.id}
      style={{
        opacity: data.isEnabled ? 1 : 0.6
      }}
    >
      <div className="timer-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
          {data.isEnabled ? (
            <Bell size={16} style={{ color: 'var(--accent)' }} />
          ) : (
            <BellOff size={16} style={{ opacity: 0.5 }} />
          )}
          <input
            type="text"
            className="timer-title"
            value={data.title}
            onChange={(e) => onUpdate({ title: e.target.value })}
            placeholder="Alarm name"
            style={{ fontSize: '14px' }}
          />
        </div>
        <div style={{ display: 'flex', gap: '4px' }}>
          <button className="timer-delete" onClick={onDelete} title="Delete alarm">
            <X size={16} />
          </button>
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          flex: 1
        }}
      >
        <div
          className={`timer-task-container ${isDragOver ? 'drag-over' : ''} ${data.taskName ? 'has-task' : ''}`}
          style={{ padding: '8px 12px', minHeight: '36px' }}
        >
          {data.taskName ? (
            <>
              <span className="timer-task-text" title={data.taskName} style={{ fontSize: '12px' }}>
                {data.taskName}
              </span>
              <button className="timer-task-clear" onClick={clearTask} title="Clear task">
                <X size={12} />
              </button>
            </>
          ) : (
            <span style={{ fontSize: '12px', opacity: 0.5 }}>Drag task here</span>
          )}
        </div>

        <div className="alarm-inputs" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Calendar size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', opacity: 0.5, pointerEvents: 'none', zIndex: 1 }} />
            <input
              type="date"
              className="time-input"
              value={data.date}
              onChange={(e) => onUpdate({ date: e.target.value, isNotified: false })}
            />
          </div>
          <div style={{ position: 'relative', width: '110px' }}>
            <Clock size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', opacity: 0.5, pointerEvents: 'none', zIndex: 1 }} />
            <input
              type="time"
              className="time-input"
              value={data.time}
              onChange={(e) => onUpdate({ time: e.target.value, isNotified: false })}
            />
          </div>
        </div>

        <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', paddingBottom: '4px' }}>
           <span style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1px', opacity: 0.4, fontWeight: 600 }}>
             Alarm {data.isEnabled ? 'Active' : 'Disabled'}
           </span>
           <label className="switch" title={data.isEnabled ? 'Disable alarm' : 'Enable alarm'}>
            <input 
              type="checkbox" 
              checked={data.isEnabled} 
              onChange={toggleEnabled} 
            />
            <span className="slider"></span>
          </label>
        </div>

      </div>
    </div>
  )
}
