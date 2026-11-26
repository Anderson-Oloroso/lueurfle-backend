/**
 * Controlador HTTP orientado a objetos para la ingesta de docs.pdf y consulta de estado en Qdrant.
 */
export class DocumentController {
  /**
   * @param {import('../services/document.service.js').DocumentService} documentService
   */
  constructor(documentService) {
    this.documentService = documentService;
  }

  /**
   * POST /api/documents/upload
   */
  async uploadPdf(req, res) {
    const levelTag = req.body?.levelTag || 'general';
    const result = await this.documentService.ingestPdf({
      file: req.file,
      levelTag
    });
    res.status(201).json({ ok: true, data: result });
  }

  /**
   * GET /api/documents
   */
  async listDocuments(_req, res) {
    const data = await this.documentService.listKnowledgeDocuments();
    res.status(200).json({ ok: true, data });
  }

  /**
   * GET /api/documents/qdrant-status
   */
  async getKnowledgeStatus(_req, res) {
    const data = await this.documentService.getKnowledgeStatus();
    res.status(200).json({ ok: true, data });
  }
}
