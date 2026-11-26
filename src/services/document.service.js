import crypto from 'node:crypto';
import { LevelCommand } from '../models/levelCommand.model.js';

/**
 * Servicio OOP para gestionar la ingesta de docs.pdf hacia n8n y consultar la base vectorial Qdrant.
 */
export class DocumentService {
  /**
   * @param {object} deps
   * @param {import('./n8nWebhook.service.js').N8nWebhookService} deps.n8nWebhookService
   * @param {import('./qdrantKnowledge.service.js').QdrantKnowledgeService} deps.qdrantKnowledgeService
   * @param {string} deps.collectionName
   */
  constructor({ n8nWebhookService, qdrantKnowledgeService, collectionName }) {
    this.n8nWebhookService = n8nWebhookService;
    this.qdrantKnowledgeService = qdrantKnowledgeService;
    this.collectionName = collectionName;
    this.recentIngestions = [];
  }

  /**
   * Valida metadatos, calcula SHA-256 y reenvía el PDF a n8n para convertirlo en embeddings en Qdrant.
   * @param {object} params
   * @param {{ originalname: string, mimetype: string, size: number, buffer: Buffer }} params.file
   * @param {string} [params.levelTag='general']
   * @returns {Promise<object>}
   */
  async ingestPdf({ file, levelTag = 'general' }) {
    const normalizedTag = LevelCommand.isValidLevel(levelTag) ? levelTag.toLowerCase() : 'general';
    const documentId = crypto.randomUUID();
    const sha256 = crypto.createHash('sha256').update(file.buffer).digest('hex');

    const record = {
      id: documentId,
      originalName: file.originalname,
      mimeType: file.mimetype,
      sizeBytes: file.size,
      sha256,
      levelTag: normalizedTag,
      collection: this.collectionName,
      status: 'pending',
      createdAt: new Date().toISOString(),
      indexedAt: null,
      errorMessage: null
    };

    try {
      const upstream = await this.n8nWebhookService.sendPdfForIngestion({
        buffer: file.buffer,
        originalname: file.originalname,
        mimetype: file.mimetype,
        levelTag: normalizedTag,
        documentId
      });

      record.status = 'indexed';
      record.indexedAt = new Date().toISOString();
      this.#remember(record);

      return {
        ...record,
        upstream
      };
    } catch (error) {
      record.status = 'failed';
      record.errorMessage = error.message;
      this.#remember(record);
      throw error;
    }
  }

  /**
   * Retorna historial reciente en memoria más fuentes detectadas en Qdrant.
   * @returns {Promise<{ collection: string, recentUploads: object[], qdrantSources: object[] }>}
   */
  async listKnowledgeDocuments() {
    const qdrantSources = await this.qdrantKnowledgeService.listIndexedSources();
    return {
      collection: this.collectionName,
      recentUploads: [...this.recentIngestions],
      qdrantSources
    };
  }

  /**
   * @returns {Promise<object>}
   */
  async getKnowledgeStatus() {
    return this.qdrantKnowledgeService.getCollectionStatus();
  }

  /**
   * @param {object} record
   */
  #remember(record) {
    this.recentIngestions.unshift(record);
    if (this.recentIngestions.length > 30) {
      this.recentIngestions.pop();
    }
  }
}
