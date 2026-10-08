import { Link } from 'react-router-dom'

export default function NotFound() {
  return (
    <div className="empty" style={{ paddingTop: 80 }}>
      <div className="empty-emoji">🛸</div>
      <h1>404 — this page drifted off</h1>
      <p>The link is wrong, or the page never existed. No stress.</p>
      <Link to="/" className="btn btn-primary">Back home</Link>
    </div>
  )
}
