// One fetch wrapper for the whole app. Server errors arrive as
//   { error: { code, message, fields? } }
// and leave here as ApiError, so pages can show inline field messages
// or a single chill toast — never a raw stack trace.

export class ApiError extends Error {
  constructor(status, code, message, fields) {
    super(message)
    this.status = status
    this.code = code
    this.fields = fields
  }
}

export async function api(method, path, body) {
  let res
  try {
    res = await fetch(`/api${path}`, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : {},
      body: body ? JSON.stringify(body) : undefined,
    })
  } catch {
    throw new ApiError(0, 'NETWORK_ERROR', "Can't reach the server — is the API running?")
  }

  const data = await res.json().catch(() => null)
  if (!res.ok) {
    const e = data?.error
    throw new ApiError(res.status, e?.code || 'ERROR', e?.message || 'Something went wrong.', e?.fields)
  }
  return data
}
