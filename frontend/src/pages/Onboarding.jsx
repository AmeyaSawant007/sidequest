import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth.jsx'
import { ErrorNote, Field, useToast } from '../ui.jsx'

const AVATARS = ['🙂', '😎', '🎨', '💻', '📝', '🎧', '📷', '🦊', '🐱', '🌟', '🛹', '☕']
const STEP_TITLES = ['Pick your vibe', 'What are you good at?', 'Say hi']

export default function Onboarding() {
  const { me, updateMe } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()
  const [step, setStep] = useState(0)
  const [avatar, setAvatar] = useState(me?.user.avatar || '🙂')
  const [skills, setSkills] = useState('')
  const [campus, setCampus] = useState('')
  const [bio, setBio] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function next() {
    setBusy(true)
    setError('')
    try {
      if (step === 0) await updateMe({ avatar })
      if (step === 1) await updateMe({ skills: skills.split(',').map((s) => s.trim()).filter(Boolean) })
      if (step === 2) {
        await updateMe({ campus, bio })
        toast("You're all set — welcome to Sidequest! 🎉", 'success')
        navigate('/explore')
        return
      }
      setStep((s) => s + 1)
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{ maxWidth: 480, margin: '30px auto' }}>
      <p className="muted">Step {step + 1} of 3</p>
      <h1>{STEP_TITLES[step]}</h1>
      <div className="card">
        {step === 0 && (
          <div className="row" style={{ gap: 10 }}>
            {AVATARS.map((a) => (
              <button
                key={a}
                className={`chip ${avatar === a ? 'on' : ''}`}
                style={{ fontSize: '1.5rem', padding: '8px 14px' }}
                onClick={() => setAvatar(a)}
              >
                {a}
              </button>
            ))}
          </div>
        )}
        {step === 1 && (
          <Field label="Skills" hint="Comma separated — keep it real, you'll get hired for these">
            <input className="input" value={skills} onChange={(e) => setSkills(e.target.value)} placeholder="Figma, React, resume editing…" />
          </Field>
        )}
        {step === 2 && (
          <>
            <Field label="Campus">
              <input className="input" value={campus} onChange={(e) => setCampus(e.target.value)} placeholder="VJTI, IIT Bombay, St. Xavier's…" />
            </Field>
            <Field label="One line about you">
              <textarea className="input" value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Design student who loves clean layouts and chai." />
            </Field>
          </>
        )}
        <ErrorNote message={error} />
        <div className="spread">
          <button className="btn btn-ghost" onClick={() => navigate('/explore')}>Skip for now</button>
          <button className="btn btn-primary" onClick={next} disabled={busy}>
            {step === 2 ? 'Finish' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  )
}
