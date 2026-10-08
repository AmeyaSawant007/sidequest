import { Link } from 'react-router-dom'
import { useAuth } from '../auth.jsx'

export default function Landing() {
  const { me } = useAuth()
  return (
    <>
      <section className="hero">
        <div className="blob blob-1" />
        <div className="blob blob-2" />
        <div className="hero-emoji">🛹</div>
        <h1>Student-to-student freelancing, minus the corporate vibes</h1>
        <p>
          Need slides fixed, a poster designed, a bug squashed? Hire a student.
          Get paid in campus credits. Every rupee-equivalent is on a public ledger —
          no shady corners, no boring forms.
        </p>
        <div className="row" style={{ justifyContent: 'center' }}>
          <Link to="/explore" className="btn btn-primary">Browse gigs</Link>
          {me
            ? <Link to="/post" className="btn btn-ghost">Post a gig</Link>
            : <Link to="/register" className="btn btn-ghost">Join the crew</Link>}
        </div>
      </section>

      <div className="grid steps">
        <div className="card">
          <div className="step-num">1</div>
          <h3>Post or pick a gig</h3>
          <p className="muted small">
            Micro-jobs with clear prices and delivery times. Design, code, writing,
            tutoring, slides — campus skills only.
          </p>
        </div>
        <div className="card">
          <div className="step-num">2</div>
          <h3>Credits sit in escrow</h3>
          <p className="muted small">
            When you order, credits lock in escrow — visible to both sides on the
            timeline. They only move when work is approved or both agree on a fix.
          </p>
        </div>
        <div className="card">
          <div className="step-num">3</div>
          <h3>Everyone levels up</h3>
          <p className="muted small">
            Finish work, earn XP, unlock badges, keep your streak alive. The
            leaderboard is friendly competition, not surveillance.
          </p>
        </div>
      </div>

      <div className="card" style={{ marginTop: 22, textAlign: 'center' }}>
        <h2>Transparency is the whole vibe 🕶️</h2>
        <p className="muted">
          Every credit movement is hash-chained on a public ledger anyone can verify.
          Reviews publish in pairs so nobody can quietly pressure the other side.
          Disputes resolve by agreement, on the record.
        </p>
        <Link to="/ledger" className="btn btn-soft">See the ledger</Link>
      </div>
    </>
  )
}
