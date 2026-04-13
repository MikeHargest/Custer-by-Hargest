import { memo } from 'react'
import { Bell, Trash2, CheckCircle, Clock, Calendar, Info, X } from 'lucide-react'
import { AppNotification } from '../types'

interface NotificationCenterProps {
  notifications: AppNotification[]
  onMarkAsRead: (id: string) => void
  onClearAll: () => void
  onClose: () => void
  onMarkAllAsRead: () => void
}

export default memo(function NotificationCenter({
  notifications,
  onMarkAsRead,
  onClearAll,
  onClose,
  onMarkAllAsRead
}: NotificationCenterProps) {
  const unreadCount = notifications.filter(n => !n.isRead).length

  return (
    <div
      className="notification-center-dropdown"
      style={{
        position: 'absolute',
        top: '100%',
        left: '0',
        marginTop: '8px',
        width: '320px',
        maxHeight: '480px',
        background: 'var(--card-bg)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 'var(--radius-lg)',
        boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 2000,
        overflow: 'hidden',
        animation: 'slideDown 0.2s ease-out'
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 16px',
          borderBottom: '1px solid rgba(255,255,255,0.05)',
          background: 'rgba(255,255,255,0.02)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Bell size={16} className={unreadCount > 0 ? 'pulse' : ''} style={{ color: unreadCount > 0 ? 'var(--accent)' : 'var(--text-secondary)' }} />
          <span style={{ fontWeight: 600, fontSize: '13px' }}>Notifications</span>
          {unreadCount > 0 && (
            <span style={{
              background: 'var(--accent)',
              color: 'white',
              fontSize: '10px',
              padding: '1px 6px',
              borderRadius: '10px',
              fontWeight: 'bold'
            }}>
              {unreadCount}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
           {notifications.length > 0 && (
             <button 
               onClick={onClearAll}
               title="Clear all"
               style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '4px' }}
             >
               <Trash2 size={14} />
             </button>
           )}
           <button 
             onClick={onClose}
             style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '4px' }}
           >
             <X size={16} />
           </button>
        </div>
      </div>

      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column'
        }}
        className="custom-scrollbar"
      >
        {notifications.length === 0 ? (
          <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-secondary)', opacity: 0.5 }}>
            <Bell size={32} style={{ marginBottom: '12px', opacity: 0.3, display: 'block', margin: '0 auto 12px' }} />
            <p style={{ fontSize: '13px' }}>No notifications yet</p>
          </div>
        ) : (
          notifications.map((n) => (
            <div
              key={n.id}
              onClick={() => onMarkAsRead(n.id)}
              style={{
                padding: '12px 16px',
                borderBottom: '1px solid rgba(255,255,255,0.03)',
                background: n.isRead ? 'transparent' : 'rgba(255,255,255,0.02)',
                cursor: 'pointer',
                display: 'flex',
                gap: '12px',
                transition: 'background 0.2s',
                position: 'relative'
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = n.isRead ? 'transparent' : 'rgba(255,255,255,0.02)')}
            >
              <div style={{ 
                width: '32px', 
                height: '32px', 
                borderRadius: '50%', 
                background: n.type === 'reminder' ? 'rgba(56, 189, 248, 0.1)' : n.type === 'timer' ? 'rgba(168, 85, 247, 0.1)' : 'rgba(255,255,255,0.05)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                color: n.type === 'reminder' ? '#38bdf8' : n.type === 'timer' ? '#a855f7' : 'var(--text-secondary)'
              }}>
                {n.type === 'reminder' && <Calendar size={16} />}
                {n.type === 'timer' && <Clock size={16} />}
                {n.type === 'system' && <Info size={16} />}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2px' }}>
                  <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {n.title}
                  </span>
                  <span style={{ fontSize: '10px', color: 'var(--text-secondary)', opacity: 0.5, flexShrink: 0 }}>
                    {new Date(n.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: 0, lineHeight: '1.4' }}>
                  {n.message}
                </p>
              </div>
              {!n.isRead && (
                <div style={{
                  position: 'absolute',
                  right: '16px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  background: 'var(--accent)'
                }} />
              )}
            </div>
          ))
        )}
      </div>

      {notifications.length > 0 && unreadCount > 0 && (
        <div style={{ padding: '10px 16px', borderTop: '1px solid rgba(255,255,255,0.05)', background: 'rgba(255,255,255,0.01)' }}>
          <button
            onClick={(e) => {
              e.stopPropagation()
              onMarkAllAsRead()
            }}
            style={{
              width: '100%',
              padding: '6px',
              background: 'rgba(255,255,255,0.05)',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              color: 'var(--text-secondary)',
              fontSize: '11px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px'
            }}
          >
            <CheckCircle size={12} />
            Mark all as read
          </button>
        </div>
      )}
    </div>
  )
})
