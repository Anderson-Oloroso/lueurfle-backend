import { MulterError } from 'multer';
import { ZodError } from 'zod';
import { AppError } from '../utils/appError.js';

/**
 * Middleware centralizado para rutas inexistentes (404) y errores HTTP/operacionales.
 */
export class ErrorHandlerMiddleware {
  /**
   * @param {boolean} [isProduction=false]
   */
  constructor(isProduction = false) {
    this.isProduction = isProduction;
  }

  /**
   * @param {import('express').Request} req
   * @param {import('express').Response} _res
   * @param {import('express').NextFunction} next
   */
  notFound(req, _res, next) {
    next(new AppError(`Route not found: ${req.method} ${req.originalUrl}`, 404, 'NOT_FOUND'));
  }

  /**
   * @param {Error} err
   * @param {import('express').Request} _req
   * @param {import('express').Response} res
   * @param {import('express').NextFunction} _next
   */
  handle(err, _req, res, _next) {
    if (err instanceof AppError) {
      return res.status(err.statusCode).json({
        ok: false,
        error: {
          code: err.code,
          message: err.message,
          ...(err.details ? { details: err.details } : {})
        }
      });
    }

    if (err instanceof ZodError) {
      return res.status(400).json({
        ok: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request payload.',
          details: err.flatten().fieldErrors
        }
      });
    }

    if (err instanceof MulterError) {
      const status = err.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
      return res.status(status).json({
        ok: false,
        error: {
          code: err.code,
          message: err.message
        }
      });
    }

    const statusCode = err.statusCode || 500;
    const message = this.isProduction ? 'Internal server error.' : err.message || 'Internal server error.';
    return res.status(statusCode).json({
      ok: false,
      error: {
        code: 'INTERNAL_ERROR',
        message
      }
    });
  }
}
