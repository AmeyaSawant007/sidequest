import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ApiError } from '../api.js'
import { useAuth } from '../auth.jsx'
import { ErrorNote, Field } from '../ui.jsx'

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ email: '', password: '' })
  const [fields, setFields] = useState({})
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    setFields({})
    try {
      await login(form)
      navigate('/dashboard')
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
      <h1>Welcome back 👋</h1>
      <form className="card" onSubmit={submit}>
        <Field label="Email" error={fields.email}>
          <input className="input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="you@student.ac.in" />
        </Field>
        <Field label="Password" error={fields.password}>
          <input className="input" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
        </Field>
        <ErrorNote message={error} />
        <button className="btn btn-primary btn-block" disabled={busy}>{busy ? 'One sec…' : 'Log in'}</button>
        <p className="small muted" style={{ textAlign: 'center' }}>
          New here? <Link to="/register">Join free</Link>
        </p>
      </form>
    </div>
  )
}
