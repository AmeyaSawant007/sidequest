import { createContext, useCallback, useContext, useState } from 'react'

/* ---------------- toasts ---------------- */
const ToastCtx = createContext(null)
export const useToast = () => useContext(ToastCtx)

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const push = useCallback((message, kind = 'info') => {
    const id = Date.now() + Math.random()
    setToasts((t) => [...t, { id, message, kind }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4200)
  }, [])
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="toast-stack" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast-${t.kind}`}>{t.message}</div>
        ))}
      </div>
    </ToastCtx.Provider>
  )
}

/* ---------------- small pieces ---------------- */
export function Avatar({ emoji, size = 'md' }) {
  return <span className={`avatar avatar-${size}`} aria-hidden="true">{emoji || '🙂'}</span>
}

export function Stars({ value, onChange }) {
  const stars = [1, 2, 3, 4, 5]
  if (!onChange) {
    return <span className="stars" aria-label={`${value} out of 5`}>{stars.map((s) => (s <= value ? '★' : '☆')).join('')}</span>
  }
  return (
    <span className="stars stars-input">
      {stars.map((s) => (
        <button key={s} type="button" className={s <= value ? 'star on' : 'star'} onClick={() => onChange(s)}>
          {s <= value ? '★' : '☆'}
        </button>
      ))}
    </span>
  )
}

export function XPBar({ level, xp }) {
  return (
    <div className="xp-wrap" title={`${xp} XP total`}>
      <div className="xp-label">Lv {level.level} · {level.title}</div>
      <div className="xp-bar"><div className="xp-fill" style={{ width: `${Math.round(level.progress * 100)}%` }} /></div>
    </div>
  )
}

const STATUS = {
  pending:          { label: 'Waiting on seller', cls: 'st-pending' },
  accepted:         { label: 'In progress',       cls: 'st-active' },
  delivered:        { label: 'Needs your approval', cls: 'st-review' },
  completed:        { label: 'Completed',         cls: 'st-done' },
  cancelled:        { label: 'Cancelled',         cls: 'st-dead' },
  disputed:         { label: 'Disputed',          cls: 'st-bad' },
  resolved_release: { label: 'Resolved · paid',   cls: 'st-done' },
  resolved_refund:  { label: 'Resolved · refunded', cls: 'st-dead' },
  resolved_split:   { label: 'Resolved · split',  cls: 'st-review' },
}

export function StatusChip({ status }) {
  const s = STATUS[status] || { label: status, cls: 'st-dead' }
  return <span className={`status ${s.cls}`}>{s.label}</span>
}

export function BadgeChip({ badge }) {
  return (
    <span className="badge-chip" title={badge.description}>
      {badge.emoji} {badge.name}
    </span>
  )
}

export function Field({ label, error, children, hint }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
      {hint && !error && <span className="field-hint">{hint}</span>}
      {error && <span className="field-error">{error}</span>}
    </label>
  )
}

export function EmptyState({ emoji = '🌙', title, children }) {
  return (
    <div className="empty">
      <div className="empty-emoji">{emoji}</div>
      <h3>{title}</h3>
      {children && <p>{children}</p>}
    </div>
  )
}

export function ErrorNote({ message }) {
  if (!message) return null
  return <div className="error-note">{message}</div>
}
