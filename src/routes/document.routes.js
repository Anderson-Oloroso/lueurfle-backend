import { Router } from 'express';

/**
 * Enrutador OOP para la ingesta de docs.pdf e inspección de Qdrant.
 */
export class DocumentRoutes {
  /**
   * @param {object} deps
   * @param {import('../controllers/document.controller.js').DocumentController} deps.documentController
   * @param {import('../middlewares/pdfValidator.middleware.js').PdfValidatorMiddleware} deps.pdfValidator
   */
  constructor({ documentController, pdfValidator }) {
    this.controller = documentController;
    this.pdfValidator = pdfValidator;
    this.router = Router();
    this.#register();
  }

  #register() {
    this.router.post(
      '/documents/upload',
      this.pdfValidator.singleFile(),
      (req, res, next) => this.pdfValidator.validateBinary(req, res, next),
      (req, res) => this.controller.uploadPdf(req, res)
    );
    this.router.get('/documents', (req, res) => this.controller.listDocuments(req, res));
    this.router.get('/documents/qdrant-status', (req, res) =>
      this.controller.getKnowledgeStatus(req, res)
    );
  }
}
