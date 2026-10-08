import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { api } from '../api.js'
import {
  Avatar, BadgeChip, EmptyState, ErrorNote, Stars, XPBar,
} from '../ui.jsx'

export default function Profile() {
  const { id } = useParams()
  const [data, setData] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    setData(null)
    api('GET', `/users/${id}`).then(setData).catch((e) => setError(e.message))
  }, [id])

  if (error) return <ErrorNote message={error} />
  if (!data) return <p className="muted">Loading profile…</p>

  const { user, badges, stats, reviews } = data

  return (
    <>
      <div className="card">
        <div className="row" style={{ gap: 18 }}>
          <Avatar emoji={user.avatar} size="xl" />
          <div style={{ flex: 1 }}>
            <h1 style={{ margin: 0 }}>
              {user.displayName} {user.isVerifiedStudent && <span title="Campus email verified">🎓</span>}
            </h1>
            <div className="muted">{user.campus || 'Campus not set'} · joined {new Date(user.createdAt).toLocaleDateString()}</div>
            <div className="row" style={{ marginTop: 8 }}>
              <XPBar level={user.level} xp={user.xp} />
              <span className="credits-pill">🔥 {user.streakDays} day streak</span>
            </div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '2rem', fontWeight: 800 }}>{stats.avgRating ?? '—'}</div>
            <Stars value={stats.avgRating || 0} />
            <div className="small muted">{stats.reviewCount} reviews</div>
          </div>
        </div>
        {user.bio && <p style={{ marginTop: 14 }}>{user.bio}</p>}
        <div className="row">
          {user.skills.map((s) => <span key={s} className="badge-chip">{s}</span>)}
        </div>
      </div>

      <div className="grid grid-2" style={{ marginTop: 16 }}>
        <div className="card">
          <h3>Badges</h3>
          <div className="row">
            {badges.length
              ? badges.map((b) => <BadgeChip key={b.code} badge={b} />)
              : <span className="muted small">No badges yet — they come with real actions.</span>}
          </div>
          <hr className="divider" />
          <div className="small muted">
            {stats.completedAsSeller} orders completed · {user.xp} XP total
          </div>
        </div>
        <div className="card">
          <h3>Reviews received</h3>
          {reviews.length === 0 && (
            <EmptyState emoji="⭐" title="No published reviews yet">
              Reviews publish in pairs — both sides post, then both appear together.
            </EmptyState>
          )}
          {reviews.map((r, i) => (
            <div key={i} className="review-card">
              <div className="row" style={{ gap: 8 }}>
                <Avatar emoji={r.reviewer.avatar} />
                <strong className="small">{r.reviewer.displayName}</strong>
                <Stars value={r.rating} />
              </div>
              {r.text && <p className="small" style={{ margin: '6px 0 0' }}>{r.text}</p>}
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
