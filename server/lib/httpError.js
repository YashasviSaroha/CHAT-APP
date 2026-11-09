export class HttpError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.statusCode = statusCode;
  }
}

export function sendError(res, error) {
  const status = error.statusCode || 500;
  if (status >= 500) console.error(error.message);
  res.status(status).json({ success: false, message: error.message || "Request failed" });
}
