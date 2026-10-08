import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api.js'
import { Avatar, ErrorNote } from '../ui.jsx'

export default function Leaderboard() {
  const [leaders, setLeaders] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    api('GET', '/leaderboard').then((d) => setLeaders(d.leaders)).catch((e) => setError(e.message))
  }, [])

  if (error) return <ErrorNote message={error} />
  if (!leaders) return <p className="muted">Crunching XP…</p>

  const [first, second, third] = leaders

  return (
    <>
      <h1>Leaderboard 🏆</h1>
      <p className="muted">Friendly competition. XP comes from real, verified actions only.</p>

      <div className="podium">
        {second && (
          <Link to={`/users/${second.id}`} className="podium-item" style={{ color: 'inherit' }}>
            <Avatar emoji={second.avatar} size="lg" />
            <div style={{ fontWeight: 800 }}>🥈 {second.displayName}</div>
            <div className="small muted">Lv {second.level.level} · {second.xp} XP</div>
          </Link>
        )}
        {first && (
          <Link to={`/users/${first.id}`} className="podium-item first" style={{ color: 'inherit' }}>
            <Avatar emoji={first.avatar} size="xl" />
            <div style={{ fontWeight: 800 }}>🥇 {first.displayName}</div>
            <div className="small muted">Lv {first.level.level} · {first.xp} XP</div>
          </Link>
        )}
        {third && (
          <Link to={`/users/${third.id}`} className="podium-item" style={{ color: 'inherit' }}>
            <Avatar emoji={third.avatar} size="lg" />
            <div style={{ fontWeight: 800 }}>🥉 {third.displayName}</div>
            <div className="small muted">Lv {third.level.level} · {third.xp} XP</div>
          </Link>
        )}
      </div>

      <div className="card">
        {leaders.map((u) => (
          <div key={u.id} className="spread" style={{ padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
            <div className="row">
              <strong style={{ width: 28 }}>#{u.rank}</strong>
              <Avatar emoji={u.avatar} />
              <div>
                <Link to={`/users/${u.id}`} style={{ fontWeight: 700 }}>{u.displayName} {u.isVerifiedStudent && '🎓'}</Link>
                <div className="small muted">Lv {u.level.level} · {u.level.title} · {u.badges} badges</div>
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontWeight: 800 }}>{u.xp} XP</div>
              <div className="small muted">+{u.weeklyXp} this week</div>
            </div>
          </div>
        ))}
      </div>
    </>
  )
}
