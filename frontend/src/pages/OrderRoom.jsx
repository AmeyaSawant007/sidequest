import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api, ApiError } from '../api.js'
import { useAuth } from '../auth.jsx'
import {
  Avatar, ErrorNote, Field, Stars, StatusChip, useToast,
} from '../ui.jsx'

const EVENT_LABEL = {
  created: 'placed the order',
  accepted: 'accepted the order',
  delivered: 'delivered the work',
  approved: 'approved the delivery',
  cancelled: 'cancelled the order',
  disputed: 'opened a dispute',
  proposed: 'proposed a resolution',
  proposal_changed: 'changed their proposal',
  resolved: 'finalised the resolution',
  message: 'said',
}

export default function OrderRoom() {
  const { id } = useParams()
  const toast = useToast()
  const { me } = useAuth()
  const [order, setOrder] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [deliverable, setDeliverable] = useState('')
  const [message, setMessage] = useState('')
  const [disputeReason, setDisputeReason] = useState('')
  const [showDispute, setShowDispute] = useState(false)
  const [review, setReview] = useState({ rating: 5, text: '' })

  const load = useCallback(() => {
    api('GET', `/orders/${id}`).then(setOrder).catch((e) => setError(e.message))
  }, [id])

  useEffect(() => { load() }, [load])

  if (error && !order) return <ErrorNote message={error} />
  if (!order) return <p className="muted">Loading order…</p>

  const isBuyer = order.role === 'buyer'
  const act = (path, body, successMsg) => async () => {
    setBusy(true)
    setError('')
    try {
      await api('POST', `/orders/${id}/${path}`, body)
      if (successMsg) toast(successMsg, 'success')
      load()
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Something went wrong.')
    } finally {
      setBusy(false)
    }
  }

  async function sendMessage(e) {
    e.preventDefault()
    if (!message.trim()) return
    await act('message', { text: message })()
    setMessage('')
  }

  async function submitReview(e) {
    e.preventDefault()
    try {
      await api('POST', `/orders/${id}/review`, review)
      toast('Review saved — it publishes when both sides post. 🤝', 'success')
      load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong.')
    }
  }

  return (
    <>
      <Link to="/dashboard" className="small muted">← My orders</Link>
      <div className="spread" style={{ marginTop: 10 }}>
        <h1 style={{ margin: 0 }}>{order.gig.title}</h1>
        <StatusChip status={order.status} />
      </div>
      <p className="muted">
        Order #{order.id} · ◎ {order.price} in escrow ·{' '}
        {isBuyer ? 'you hired' : 'you work for'}{' '}
        <Link to={`/users/${isBuyer ? order.seller.id : order.buyer.id}`}>
          {isBuyer ? order.seller.displayName : order.buyer.displayName}
        </Link>
      </p>

      <div className="grid grid-2">
        <div>
          {/* ---- escrow + actions ---- */}
          <div className="card">
            <h3>🔒 Escrow status</h3>
            <p className="small muted">
              {order.status === 'pending' && 'Your credits are locked until the seller accepts — cancel any time for a full refund.'}
              {order.status === 'accepted' && 'Work is in progress. Credits release only when you approve, or both sides agree on a resolution.'}
              {order.status === 'delivered' && 'The work is in. Approve to release the credits, or raise a dispute if something is off.'}
              {order.status === 'completed' && 'Done and dusted — credits released to the seller.'}
              {order.status === 'cancelled' && 'Order cancelled. Credits went back to the buyer.'}
              {order.status === 'disputed' && 'Paused. Both sides pick a resolution — when the answers match, it executes automatically.'}
              {order.status.startsWith('resolved_') && 'Dispute closed. The outcome is on the public timeline.'}
            </p>
            {order.deliverable && (
              <p className="small"><strong>Deliverable:</strong> {order.deliverable}</p>
            )}
            <ErrorNote message={error} />
            <div className="row">
              {order.status === 'pending' && (
                <>
                  {!isBuyer && <button className="btn btn-mint" disabled={busy} onClick={act('accept', null, 'Order accepted — good luck! 🍀')}>Accept order</button>}
                  <button className="btn btn-danger" disabled={busy} onClick={act('cancel', null, 'Order cancelled — credits refunded.')}>Cancel & refund</button>
                </>
              )}
              {order.status === 'accepted' && !isBuyer && (
                <form className="row" style={{ width: '100%' }} onSubmit={(e) => { e.preventDefault(); act('deliver', { deliverable }, 'Delivered! Waiting for approval. 📦')() }}>
                  <input className="input" style={{ flex: 1 }} placeholder="Link or summary of what you delivered" value={deliverable} onChange={(e) => setDeliverable(e.target.value)} />
                  <button className="btn btn-primary" disabled={busy}>Deliver</button>
                </form>
              )}
              {order.status === 'delivered' && isBuyer && (
                <button className="btn btn-primary" disabled={busy} onClick={act('approve', null, 'Approved — credits released! ⚡')}>Approve & release ◎ {order.price}</button>
              )}
              {['accepted', 'delivered'].includes(order.status) && (
                <button className="btn btn-ghost" onClick={() => setShowDispute((s) => !s)}>Something's off?</button>
              )}
              {order.status === 'disputed' && (
                <>
                  {['release', 'refund', 'split'].map((r) => (
                    <button
                      key={r}
                      className={`btn ${order.resolutionProposal === r ? 'btn-primary' : 'btn-soft'}`}
                      disabled={busy}
                      onClick={act('resolve', { resolution: r }, 'Proposal noted — waiting for the other side.')}
                    >
                      Propose: {r}
                    </button>
                  ))}
                  <p className="small muted" style={{ width: '100%' }}>
                    Current proposals: yours + theirs must match. {order.resolutionProposal ? `On the table: ${order.resolutionProposal}.` : 'Nothing on the table yet.'}
                  </p>
                </>
              )}
            </div>
            {showDispute && (
              <form onSubmit={(e) => { e.preventDefault(); act('dispute', { reason: disputeReason }, 'Dispute opened — both sides can see the same record.')() }}>
                <Field label="What went wrong?">
                  <textarea className="input" value={disputeReason} onChange={(e) => setDisputeReason(e.target.value)} placeholder="Be specific — this goes on the shared timeline." />
                </Field>
                <button className="btn btn-danger btn-sm" disabled={busy}>Open dispute</button>
              </form>
            )}
          </div>

          {/* ---- review ---- */}
          {order.canReview && (
            <form className="card" onSubmit={submitReview}>
              <h3>Leave a review</h3>
              <p className="small muted">
                Reviews publish in pairs — yours stays private until {isBuyer ? order.seller.displayName : order.buyer.displayName} posts theirs too (or 72h pass). Fair by design.
              </p>
              <Stars value={review.rating} onChange={(rating) => setReview((r) => ({ ...r, rating }))} />
              <Field label="How did it go?">
                <textarea className="input" value={review.text} onChange={(e) => setReview((r) => ({ ...r, text: e.target.value }))} placeholder="Honest, kind, specific." />
              </Field>
              <button className="btn btn-primary" disabled={busy}>Post review</button>
            </form>
          )}
          {order.myReview && (
            <div className="card">
              <h3>Your review</h3>
              <div className="review-card">
                <Stars value={order.myReview.rating} />
                <p style={{ margin: '6px 0 0' }}>{order.myReview.text || <span className="muted">No words, just stars.</span>}</p>
              </div>
              {order.reviews.length === 1 && (
                <p className="small muted">Waiting for the other side's review to publish together.</p>
              )}
            </div>
          )}

          {/* ---- messages ---- */}
          <div className="card">
            <h3>Messages</h3>
            <p className="small muted">Order chat is part of the shared record — kept with the timeline.</p>
            <ul className="timeline">
              {order.events.filter((e) => e.event === 'message').map((e) => (
                <li key={e.id}>
                  <span className="tl-actor">{e.actor?.displayName || 'Someone'}:</span> {e.detail}
                  <div className="tl-time">{new Date(e.createdAt).toLocaleString()}</div>
                </li>
              ))}
            </ul>
            <form className="row" onSubmit={sendMessage}>
              <input className="input" style={{ flex: 1 }} placeholder="Say something…" value={message} onChange={(e) => setMessage(e.target.value)} />
              <button className="btn btn-soft btn-sm">Send</button>
            </form>
          </div>
        </div>

        {/* ---- timeline & people ---- */}
        <div>
          <div className="card">
            <h3>📜 Timeline</h3>
            <ul className="timeline">
              {order.events.filter((e) => e.event !== 'message').map((e) => (
                <li key={e.id}>
                  <span className="tl-actor">{e.actor?.displayName || 'System'}</span>{' '}
                  {EVENT_LABEL[e.event] || e.event}{e.detail && e.event !== 'message' ? ` — ${e.detail}` : ''}
                  <div className="tl-time">{new Date(e.createdAt).toLocaleString()}</div>
                </li>
              ))}
            </ul>
          </div>
          <div className="card">
            <h3>People</h3>
            <div className="row">
              <Avatar emoji={order.buyer.avatar} size="lg" />
              <div>
                <Link to={`/users/${order.buyer.id}`} style={{ fontWeight: 700 }}>{order.buyer.displayName} {order.buyer.isVerifiedStudent && '🎓'}</Link>
                <div className="small muted">Buyer · Lv {order.buyer.level.level} {order.buyer.level.title}</div>
              </div>
            </div>
            <hr className="divider" />
            <div className="row">
              <Avatar emoji={order.seller.avatar} size="lg" />
              <div>
                <Link to={`/users/${order.seller.id}`} style={{ fontWeight: 700 }}>{order.seller.displayName} {order.seller.isVerifiedStudent && '🎓'}</Link>
                <div className="small muted">Seller · Lv {order.seller.level.level} {order.seller.level.title}</div>
              </div>
            </div>
          </div>
          <div className="card">
            <h3>Pair reviews</h3>
            {order.reviews.length === 0 && <p className="small muted">No published reviews for this order yet.</p>}
            {order.reviews.map((r) => (
              <div key={r.id} className="review-card">
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
      </div>
    </>
  )
}
