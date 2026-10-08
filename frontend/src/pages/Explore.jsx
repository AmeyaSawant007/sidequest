import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api.js'
import { Avatar, EmptyState, ErrorNote, Stars } from '../ui.jsx'

export default function Explore() {
  const [data, setData] = useState({ categories: [], gigs: [] })
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('')
  const [sort, setSort] = useState('recent')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    setLoading(true)
    const params = new URLSearchParams({ query, category, sort })
    api('GET', `/gigs?${params}`)
      .then((d) => { if (alive) { setData(d); setError('') } })
      .catch((e) => { if (alive) setError(e.message) })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [query, category, sort])

  return (
    <>
      <div className="spread">
        <h1>Explore gigs</h1>
        <Link to="/post" className="btn btn-primary btn-sm">+ Post a gig</Link>
      </div>

      <form className="row" style={{ margin: '14px 0' }} onSubmit={(e) => e.preventDefault()}>
        <input
          className="input" style={{ flex: 1, minWidth: 220 }}
          placeholder="Search gigs… (try 'poster' or 'python')"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <select className="input" style={{ width: 160 }} value={sort} onChange={(e) => setSort(e.target.value)}>
          <option value="recent">Newest</option>
          <option value="price_asc">Price ↑</option>
          <option value="price_desc">Price ↓</option>
        </select>
      </form>

      <div className="row" style={{ marginBottom: 18 }}>
        <button className={`chip ${category === '' ? 'on' : ''}`} onClick={() => setCategory('')}>All</button>
        {data.categories.map((c) => (
          <button key={c} className={`chip ${category === c ? 'on' : ''}`} onClick={() => setCategory(c)}>{c}</button>
        ))}
      </div>

      <ErrorNote message={error} />
      {loading && <p className="muted">Loading gigs…</p>}
      {!loading && !data.gigs.length && (
        <EmptyState emoji="🔍" title="No gigs here yet">
          Be the first — post one and earn your First Gig badge.
        </EmptyState>
      )}

      <div className="grid grid-3">
        {data.gigs.map((gig) => (
          <Link key={gig.id} to={`/gigs/${gig.id}`} className="card gig-card" style={{ color: 'inherit' }}>
            <div className="gig-cat">{gig.category}</div>
            <h3 style={{ margin: 0 }}>{gig.title}</h3>
            <p className="muted small" style={{ margin: 0, flex: 1 }}>{gig.description.slice(0, 100)}…</p>
            <div className="spread">
              <div className="row" style={{ gap: 8 }}>
                <Avatar emoji={gig.owner.avatar} />
                <div>
                  <div className="small" style={{ fontWeight: 700 }}>{gig.owner.displayName}</div>
                  <div className="small muted">
                    {gig.owner.avgRating ? <><Stars value={gig.owner.avgRating} /> {gig.owner.avgRating}</> : 'No reviews yet'}
                  </div>
                </div>
              </div>
              <div className="gig-price">
                ◎ {gig.price} <small>/ {gig.deliveryDays}d</small>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </>
  )
}
