import { AppError } from '../utils/appError.js';

/**
 * Cliente HTTP orientado a objetos para comunicarse con los webhooks de n8n.
 */
export class N8nWebhookService {
  /**
   * @param {object} params
   * @param {string} params.baseUrl
   * @param {string} params.chatWebhookPath
   * @param {string} params.ingestWebhookPath
   * @param {number} [params.timeoutMs=25000]
   * @param {typeof fetch} [params.fetchImpl=fetch]
   */
  constructor({
    baseUrl,
    chatWebhookPath,
    ingestWebhookPath,
    timeoutMs = 25000,
    fetchImpl = fetch
  }) {
    this.baseUrl = String(baseUrl || '').replace(/\/+$/, '');
    this.chatWebhookPath = chatWebhookPath;
    this.ingestWebhookPath = ingestWebhookPath;
    this.timeoutMs = timeoutMs;
    this.fetchImpl = fetchImpl;
  }

  /**
   * Envía un turno de conversación al workflow RAG de n8n.
   * @param {object} payload
   * @returns {Promise<object>}
   */
  async sendChatTurn(payload) {
    const url = `${this.baseUrl}${this.chatWebhookPath}`;
    return this.#requestJson(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  }

  /**
   * Envía un archivo docs.pdf binario al webhook de ingesta de n8n para generar embeddings en Qdrant.
   * @param {object} params
   * @param {Buffer} params.buffer
   * @param {string} params.originalname
   * @param {string} params.mimetype
   * @param {string} [params.levelTag='general']
   * @param {string} params.documentId
   * @returns {Promise<object>}
   */
  async sendPdfForIngestion({ buffer, originalname, mimetype, levelTag = 'general', documentId }) {
    const url = `${this.baseUrl}${this.ingestWebhookPath}`;
    const formData = new FormData();
    const blob = new Blob([buffer], { type: mimetype || 'application/pdf' });

    formData.append('file', blob, originalname || 'docs.pdf');
    formData.append('originalName', originalname || 'docs.pdf');
    formData.append('levelTag', levelTag);
    formData.append('documentId', documentId);

    return this.#requestJson(url, {
      method: 'POST',
      body: formData
    });
  }

  /**
   * @param {string} url
   * @param {RequestInit} init
   * @returns {Promise<object>}
   */
  async #requestJson(url, init) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await this.fetchImpl(url, {
        ...init,
        signal: controller.signal
      });

      const text = await response.text();
      let data = {};
      if (text) {
        try {
          data = JSON.parse(text);
        } catch {
          data = { reply: text };
        }
      }

      if (!response.ok) {
        throw new AppError(
          `n8n webhook responded with status ${response.status}`,
          502,
          'N8N_UPSTREAM_ERROR',
          data
        );
      }

      return data;
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      if (error.name === 'AbortError') {
        throw new AppError('n8n webhook request timed out.', 504, 'N8N_TIMEOUT');
      }
      throw new AppError(
        `Unable to reach n8n webhook: ${error.message}`,
        502,
        'N8N_CONNECTION_ERROR'
      );
    } finally {
      clearTimeout(timer);
    }
  }
}
