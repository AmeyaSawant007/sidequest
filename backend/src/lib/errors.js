// One error shape for the whole API. Every failure leaves the server as:
//   { "error": { "code": "...", "message": "chill human sentence", "fields": { ... } } }
// so the React side never has to guess what went wrong.

class ApiError extends Error {
  constructor(status, code, message, fields) {
    super(message);
    this.status = status;
    this.code = code;
    this.fields = fields;
  }
}

const badRequest = (message, fields) => new ApiError(400, 'VALIDATION_ERROR', message, fields);
const unauthorized = (message = 'You need to sign in to do that.') =>
  new ApiError(401, 'UNAUTHENTICATED', message);
const forbidden = (message = "That's not yours to touch.") =>
  new ApiError(403, 'FORBIDDEN', message);
const notFound = (message = "Couldn't find that.") => new ApiError(404, 'NOT_FOUND', message);
const conflict = (message, fields) => new ApiError(409, 'CONFLICT', message, fields);

// Final middleware: turns any thrown error into the contract above.
// Known plumbing errors (bad JSON, oversized bodies) get friendly statuses;
// unknown errors are logged with an id, and the client gets a safe generic.
function errorHandler(err, req, res, _next) {
  if (err instanceof ApiError) {
    return res.status(err.status).json({
      error: { code: err.code, message: err.message, ...(err.fields ? { fields: err.fields } : {}) },
    });
  }
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: "That request body wasn't valid JSON." },
    });
  }
  if (err.type === 'entity.too.large') {
    return res.status(413).json({
      error: { code: 'PAYLOAD_TOO_LARGE', message: 'That payload is too chunky — keep it under 256kb.' },
    });
  }
  const errorId = Date.now().toString(36);
  console.error(`[${errorId}]`, err);
  res.status(500).json({
    error: {
      code: 'SERVER_ERROR',
      message: `Something glitched on our side (ref ${errorId}). Try again?`,
    },
  });
}

module.exports = { ApiError, badRequest, unauthorized, forbidden, notFound, conflict, errorHandler };
