import multer from 'multer';
import { AppError } from '../utils/appError.js';

/**
 * Valida la recepción multipart de archivos PDF verificando extensión, MIME, tamaño y firma %PDF-.
 */
export class PdfValidatorMiddleware {
  /**
   * @param {object} [options]
   * @param {number} [options.maxPdfSizeBytes=15728640]
   */
  constructor({ maxPdfSizeBytes = 15 * 1024 * 1024 } = {}) {
    this.maxPdfSizeBytes = maxPdfSizeBytes;
    this.upload = multer({
      storage: multer.memoryStorage(),
      limits: {
        fileSize: this.maxPdfSizeBytes,
        files: 1
      },
      fileFilter: (_req, file, cb) => {
        const isPdfName = String(file.originalname || '').toLowerCase().endsWith('.pdf');
        const isPdfMime = file.mimetype === 'application/pdf';
        if (!isPdfName || !isPdfMime) {
          cb(new AppError('Only valid .pdf files (application/pdf) are accepted.', 400, 'INVALID_PDF_TYPE'));
          return;
        }
        cb(null, true);
      }
    });
  }

  /**
   * Middleware multer para un único archivo bajo el campo 'file'.
   * @returns {import('express').RequestHandler}
   */
  singleFile() {
    return this.upload.single('file');
  }

  /**
   * Verifica presencia del buffer y cabecera mágica %PDF-.
   * @param {import('express').Request} req
   * @param {import('express').Response} _res
   * @param {import('express').NextFunction} next
   */
  validateBinary(req, _res, next) {
    if (!req.file || !Buffer.isBuffer(req.file.buffer) || req.file.buffer.length < 5) {
      return next(new AppError('A non-empty PDF file is required in field "file".', 400, 'MISSING_PDF_FILE'));
    }

    const signature = req.file.buffer.subarray(0, 5).toString('ascii');
    if (signature !== '%PDF-') {
      return next(new AppError('Uploaded file does not have a valid %PDF- signature.', 400, 'INVALID_PDF_SIGNATURE'));
    }

    return next();
  }
}
