/**
 * Global error handling middleware
 */
export default function errorHandler(err, req, res, next) {
  console.error('Error:', err);

  // Default error status and message
  const status = err.status || 500;
  const message = err.message || 'Internal Server Error';

  res.status(status).json({
    error: message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
}
