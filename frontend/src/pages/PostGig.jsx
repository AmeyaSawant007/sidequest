import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, ApiError } from '../api.js'
import { ErrorNote, Field, useToast } from '../ui.jsx'

export default function PostGig() {
  const navigate = useNavigate()
  const toast = useToast()
  const [categories, setCategories] = useState([])
  const [form, setForm] = useState({ title: '', description: '', category: '', tags: '', price: 50, deliveryDays: 3 })
  const [fields, setFields] = useState({})
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    api('GET', '/gigs').then((d) => setCategories(d.categories)).catch(() => {})
  }, [])

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setFields({})
    setError('')
    try {
      const gig = await api('POST', '/gigs', { ...form, price: Number(form.price), deliveryDays: Number(form.deliveryDays) })
      toast('Gig is live — nice! 🎉', 'success')
      navigate(`/gigs/${gig.id}`)
    } catch (err) {
      if (err instanceof ApiError) {
        setFields(err.fields || {})
        setError(err.message)
      } else setError('Something went wrong.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{ maxWidth: 560, margin: '0 auto' }}>
      <h1>Post a gig</h1>
      <p className="muted">Keep it real: clear scope, fair price, honest timeline.</p>
      <form className="card" onSubmit={submit}>
        <Field label="Title" error={fields.title} hint="“I will design a chill poster for your event”">
          <input className="input" value={form.title} onChange={set('title')} placeholder="I will…" />
        </Field>
        <Field label="What do they get?" error={fields.description}>
          <textarea className="input" value={form.description} onChange={set('description')} placeholder="Deliverables, revisions, format…" />
        </Field>
        <Field label="Category" error={fields.category}>
          <select className="input" value={form.category} onChange={set('category')}>
            <option value="">Pick one…</option>
            {categories.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </Field>
        <Field label="Tags" hint="Comma separated — 'posters, figma'">
          <input className="input" value={form.tags} onChange={set('tags')} />
        </Field>
        <div className="row">
          <div style={{ flex: 1 }}>
            <Field label="Price (credits)" error={fields.price}>
              <input className="input" type="number" min="1" value={form.price} onChange={set('price')} />
            </Field>
          </div>
          <div style={{ flex: 1 }}>
            <Field label="Delivery (days)" error={fields.deliveryDays}>
              <input className="input" type="number" min="1" value={form.deliveryDays} onChange={set('deliveryDays')} />
            </Field>
          </div>
        </div>
        <ErrorNote message={error} />
        <button className="btn btn-primary btn-block" disabled={busy}>
          {busy ? 'Posting…' : 'Post gig'}
        </button>
      </form>
    </div>
  )
}
