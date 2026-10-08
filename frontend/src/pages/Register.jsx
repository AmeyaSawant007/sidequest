import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ApiError } from '../api.js'
import { useAuth } from '../auth.jsx'
import { ErrorNote, Field } from '../ui.jsx'

export default function Register() {
  const { register } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ email: '', password: '', displayName: '' })
  const [fields, setFields] = useState({})
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    setFields({})
    try {
      await register(form)
      navigate('/onboarding')
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
    <div style={{ maxWidth: 420, margin: '40px auto' }}>
      <h1>Join the crew 🛹</h1>
      <p className="muted">Free, chill, and you start with 250 credits to hire fellow students.</p>
      <form className="card" onSubmit={submit}>
        <Field label="Display name" error={fields.displayName} hint="What people see on your gigs and reviews">
          <input className="input" value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} placeholder="Maya, Arjun, CoolCoder99…" />
        </Field>
        <Field label="Email" error={fields.email} hint="Campus emails (.edu, .ac.in…) get a 🎓 trust badge — no documents, ever">
          <input className="input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="you@student.ac.in" />
        </Field>
        <Field label="Password" error={fields.password} hint="8+ characters">
          <input className="input" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
        </Field>
        <ErrorNote message={error} />
        <button className="btn btn-primary btn-block" disabled={busy}>{busy ? 'Creating…' : 'Create account'}</button>
        <p className="small muted" style={{ textAlign: 'center' }}>
          Already in? <Link to="/login">Log in</Link>
        </p>
      </form>
    </div>
  )
}
