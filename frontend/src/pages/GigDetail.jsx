import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api, ApiError } from '../api.js'
import { useAuth } from '../auth.jsx'
import { Avatar, BadgeChip, ErrorNote, Field, Stars, useToast } from '../ui.jsx'

export default function GigDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const toast = useToast()
  const { me } = useAuth()
  const [gig, setGig] = useState(null)
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    api('GET', `/gigs/${id}`).then(setGig).catch((e) => setError(e.message))
  }, [id])

  if (error && !gig) return <ErrorNote message={error} />
  if (!gig) return <p className="muted">Loading…</p>

  const isOwner = me && me.user.id === gig.owner.id

  async function hire() {
    setBusy(true)
    setError('')
    try {
      const order = await api('POST', '/orders', { gigId: gig.id, note })
      toast('Order placed — credits locked in escrow 🔒', 'success')
      navigate(`/orders/${order.id}`)
    } catch (e) {
      if (e instanceof ApiError) setError(e.message)
      else setError('Something went wrong.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <Link to="/explore" className="small muted">← Back to explore</Link>
      <div className="grid grid-2" style={{ marginTop: 12 }}>
        <div className="card">
          <div className="gig-cat">{gig.category}</div>
          <h1 style={{ marginTop: 6 }}>{gig.title}</h1>
          <p>{gig.description}</p>
          <div className="row">
            {gig.tags.map((t) => <span key={t} className="badge-chip">#{t}</span>)}
          </div>
          <hr className="divider" />
          <div className="spread">
            <div>
              <div className="gig-price">◎ {gig.price}</div>
              <div className="muted small">delivered in {gig.deliveryDays} day{gig.deliveryDays > 1 ? 's' : ''}</div>
            </div>
          </div>
        </div>

        <div>
          <div className="card">
            <div className="row">
              <Link to={`/users/${gig.owner.id}`}><Avatar emoji={gig.owner.avatar} size="lg" /></Link>
              <div>
                <h3 style={{ margin: 0 }}>
                  <Link to={`/users/${gig.owner.id}`}>{gig.owner.displayName}</Link>
                  {gig.owner.isVerifiedStudent && ' 🎓'}
                </h3>
                <div className="small muted">
                  Lv {gig.owner.level.level} · {gig.owner.level.title} · {gig.owner.completedOrders} orders done
                </div>
                <div className="small">
                  {gig.owner.avgRating
                    ? <><Stars value={gig.owner.avgRating} /> {gig.owner.avgRating} ({gig.owner.reviewCount})</>
                    : <span className="muted">No reviews yet</span>}
                </div>
              </div>
            </div>
            <div className="row" style={{ marginTop: 12 }}>
              {gig.owner.badges.map((b) => <BadgeChip key={b.code} badge={b} />)}
            </div>
          </div>

          {!isOwner && (
            <div className="card">
              <h3>Hire {gig.owner.displayName.split(' ')[0]}</h3>
              {!me && <p className="muted small">Log in to order — you'll get 250 free credits to start.</p>}
              <Field label="Note (what do you need?)">
                <textarea
                  className="input" value={note} disabled={!me}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Deadline, style, links — anything helpful."
                />
              </Field>
              <ErrorNote message={error} />
              {me ? (
                <button className="btn btn-primary btn-block" onClick={hire} disabled={busy}>
                  {busy ? 'Placing order…' : `Order for ◎ ${gig.price}`}
                </button>
              ) : (
                <Link to="/login" className="btn btn-primary btn-block">Log in to order</Link>
              )}
              <p className="muted small" style={{ marginBottom: 0 }}>
                Credits lock in escrow and only move when you approve the work.
              </p>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
