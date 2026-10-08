import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api.js'
import { ErrorNote } from '../ui.jsx'

const TYPE_LABEL = {
  grant: '🎁 Welcome grant',
  escrow_fund: '🔒 Escrow funded',
  escrow_release: '⚡ Escrow released',
  escrow_refund: '↩️ Escrow refunded',
  escrow_split_release: '⚖️ Split · seller share',
  escrow_split_refund: '⚖️ Split · buyer share',
}

export default function LedgerPage() {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    api('GET', '/ledger?limit=100').then(setData).catch((e) => setError(e.message))
  }, [])

  if (error) return <ErrorNote message={error} />
  if (!data) return <p className="muted">Loading ledger…</p>

  return (
    <>
      <h1>The public ledger 📒</h1>
      <p className="muted" style={{ maxWidth: 640 }}>
        Every credit that ever moved, in order, hash-chained. Each entry's hash covers
        its payload plus the previous entry's hash — edit any row (even in a database
        shell) and the chain verification below breaks loudly. No hidden transactions,
        no admin edits, no exceptions.
      </p>

      {data.verify.ok ? (
        <div className="verify-ok">✅ Chain intact — all {data.verify.entries} entries verified</div>
      ) : (
        <div className="verify-bad">
          ❌ Chain broken at entry #{data.verify.brokenAt} ({data.verify.reason})
        </div>
      )}

      <div className="card" style={{ marginTop: 16, overflowX: 'auto' }}>
        <table className="ledger-table">
          <thead>
            <tr>
              <th>#</th><th>What</th><th>Who</th><th>Amount</th><th>Balance</th><th>Hash</th><th>When</th>
            </tr>
          </thead>
          <tbody>
            {data.entries.map((e) => (
              <tr key={e.id}>
                <td>{e.id}</td>
                <td>
                  {TYPE_LABEL[e.type] || e.type}
                  <div className="small muted">{e.memo}</div>
                  {e.entryHash && <div className="hash">🔗 {e.entryHash.slice(0, 18)}…</div>}
                </td>
                <td className="small">{e.actor ? <Link to={`/users/${e.actor.id}`}>{e.actor.avatar} {e.actor.displayName}</Link> : '—'}</td>
                <td className={e.amount >= 0 ? 'amount-plus' : 'amount-minus'}>
                  {e.amount >= 0 ? '+' : ''}{e.amount} cr
                </td>
                <td className="small">{e.balanceAfter}</td>
                <td className="hash" title={e.prevHash}>prev: {e.prevHash.slice(0, 10)}…</td>
                <td className="small muted">{new Date(e.createdAt).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
