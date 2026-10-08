import { Link, NavLink, Navigate, Route, Routes, useNavigate } from 'react-router-dom'
import { useAuth } from './auth.jsx'
import { Avatar, XPBar } from './ui.jsx'
import Landing from './pages/Landing.jsx'
import Explore from './pages/Explore.jsx'
import GigDetail from './pages/GigDetail.jsx'
import PostGig from './pages/PostGig.jsx'
import Dashboard from './pages/Dashboard.jsx'
import OrderRoom from './pages/OrderRoom.jsx'
import LedgerPage from './pages/LedgerPage.jsx'
import Leaderboard from './pages/Leaderboard.jsx'
import Profile from './pages/Profile.jsx'
import Login from './pages/Login.jsx'
import Register from './pages/Register.jsx'
import Onboarding from './pages/Onboarding.jsx'
import NotFound from './pages/NotFound.jsx'

function RequireAuth({ children }) {
  const { me, loading } = useAuth()
  if (loading) return <div className="container"><p className="muted">Loading…</p></div>
  if (!me) return <Navigate to="/login" replace />
  return children
}

function Nav() {
  const { me, logout } = useAuth()
  const navigate = useNavigate()
  return (
    <nav className="nav">
      <Link to="/" className="nav-logo">🛹 Sidequest</Link>
      <div className="nav-links">
        <NavLink to="/explore">Explore</NavLink>
        {me && <NavLink to="/dashboard">My orders</NavLink>}
        {me && <NavLink to="/post">Post a gig</NavLink>}
        <NavLink to="/leaderboard">Leaderboard</NavLink>
        <NavLink to="/ledger">Ledger</NavLink>
      </div>
      <div className="nav-spacer" />
      {me ? (
        <div className="nav-user">
          <XPBar level={me.user.level} xp={me.user.xp} />
          <span className="credits-pill">◎ {me.user.credits} cr</span>
          <Link to={`/users/${me.user.id}`}><Avatar emoji={me.user.avatar} /></Link>
          <button
            className="btn btn-ghost btn-sm"
            onClick={async () => { await logout(); navigate('/') }}
          >
            Log out
          </button>
        </div>
      ) : (
        <div className="row">
          <Link to="/login" className="btn btn-ghost btn-sm">Log in</Link>
          <Link to="/register" className="btn btn-primary btn-sm">Join free</Link>
        </div>
      )}
    </nav>
  )
}

export default function App() {
  return (
    <>
      <Nav />
      <main className="container">
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/explore" element={<Explore />} />
          <Route path="/gigs/:id" element={<GigDetail />} />
          <Route path="/leaderboard" element={<Leaderboard />} />
          <Route path="/ledger" element={<LedgerPage />} />
          <Route path="/users/:id" element={<Profile />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/onboarding" element={<RequireAuth><Onboarding /></RequireAuth>} />
          <Route path="/post" element={<RequireAuth><PostGig /></RequireAuth>} />
          <Route path="/dashboard" element={<RequireAuth><Dashboard /></RequireAuth>} />
          <Route path="/orders/:id" element={<RequireAuth><OrderRoom /></RequireAuth>} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
      <footer className="footer">
        Sidequest · built by students, for students · every credit is on the{' '}
        <Link to="/ledger">public ledger</Link>
      </footer>
    </>
  )
}
