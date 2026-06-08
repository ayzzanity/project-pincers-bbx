class AppError extends Error {
  constructor(status, code, message, details = null) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

function errorResponse(error) {
  const status = error.status || 500;
  const code = error.code || 'internal_error';

  return {
    status,
    body: {
      error: {
        code,
        message: error.message || 'Internal server error',
        details: error.details || null
      }
    }
  };
}

module.exports = {
  AppError,
  errorResponse
};
