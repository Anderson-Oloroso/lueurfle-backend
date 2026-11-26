import { Router } from 'express';

/**
 * Enrutador raíz de la API REST (/api).
 */
export class ApiRouter {
  /**
   * @param {object} deps
   * @param {import('./chat.routes.js').ChatRoutes} deps.chatRoutes
   * @param {import('./document.routes.js').DocumentRoutes} deps.documentRoutes
   */
  constructor({ chatRoutes, documentRoutes }) {
    this.router = Router();
    this.router.use(chatRoutes.router);
    this.router.use(documentRoutes.router);
  }
}
