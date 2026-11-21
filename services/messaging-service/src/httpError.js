/** An error that carries the HTTP status to answer with (used by the controllers and the auth-service client). */
class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status }
}

module.exports = { HttpError }
