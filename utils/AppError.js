class AppError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor); // giữ stack trace chính xác
  }
}

module.exports = AppError;
