import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api.js'
import { useAuth } from '../auth.jsx'
import { Avatar, EmptyState, ErrorNote, StatusChip } from '../ui.jsx'

function OrderRow({ order }) {
  return (
    <Link to={`/orders/${order.id}`} className="card" style={{ display: 'block', color: 'inherit', marginBottom: 12 }}>
      <div className="spread">
        <div className="row">
          <Avatar emoji={order.counterpart.avatar} />
          <div>
            <div style={{ fontWeight: 700 }}>{order.gig.title}</div>
            <div className="small muted">
              {order.role === 'buyer' ? 'hiring' : 'working for'} {order.counterpart.displayName} · ◎ {order.price}
            </div>
          </div>
        </div>
        <StatusChip status={order.status} />
      </div>
    </Link>
  )
}

export default function Dashboard() {
  const { me } = useAuth()
  const [orders, setOrders] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    api('GET', '/orders').then((d) => setOrders(d.orders)).catch((e) => setError(e.message))
  }, [])

  if (error) return <ErrorNote message={error} />
  if (!orders) return <p className="muted">Loading your orders…</p>

  const buying = orders.filter((o) => o.role === 'buyer')
  const selling = orders.filter((o) => o.role === 'seller')

  return (
    <>
      <h1>Hey {me.user.displayName.split(' ')[0]} 👋</h1>
      <p className="muted">Everything you're part of, both sides of the table.</p>
      <div className="grid grid-2">
        <div>
          <h2>🛒 Buying</h2>
          {buying.length
            ? buying.map((o) => <OrderRow key={o.id} order={o} />)
            : <EmptyState emoji="🛒" title="Nothing here yet">Find a gig and hire a fellow student.</EmptyState>}
        </div>
        <div>
          <h2>🛠️ Selling</h2>
          {selling.length
            ? selling.map((o) => <OrderRow key={o.id} order={o} />)
            : <EmptyState emoji="🛠️" title="No gigs in motion">Post a gig — someone needs exactly what you do.</EmptyState>}
        </div>
      </div>
    </>
  )
}
