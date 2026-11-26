import { AppError } from '../utils/appError.js';

/**
 * Configuración centralizada, validada e inmutable para lueurfle-backend.
 * Única base de conocimiento: Qdrant (sin dependencias SQL).
 */
export class EnvConfig {
  /**
   * @param {NodeJS.ProcessEnv} [envSource=process.env]
   */
  constructor(envSource = process.env) {
    this.nodeEnv = String(envSource.NODE_ENV || 'development').trim();
    this.port = this.#parsePositiveInt(envSource.PORT, 3000, 'PORT', 65535);
    this.corsOrigins = this.#parseCorsOrigins(envSource.CORS_ORIGIN || 'http://localhost:5500');

    this.rateLimitWindowMs = this.#parsePositiveInt(
      envSource.RATE_LIMIT_WINDOW_MS,
      60000,
      'RATE_LIMIT_WINDOW_MS'
    );
    this.rateLimitMax = this.#parsePositiveInt(envSource.RATE_LIMIT_MAX, 60, 'RATE_LIMIT_MAX');

    this.n8nBaseUrl = this.#normalizeUrl(
      envSource.N8N_BASE_URL || 'http://localhost:5678',
      'N8N_BASE_URL'
    );
    this.n8nIngestWebhookPath = this.#normalizePath(
      envSource.N8N_INGEST_WEBHOOK_PATH || '/webhook/ingest-pdf'
    );
    this.n8nChatWebhookPath = this.#normalizePath(
      envSource.N8N_CHAT_WEBHOOK_PATH || '/webhook/chat-french'
    );
    this.n8nTimeoutMs = this.#parsePositiveInt(envSource.N8N_TIMEOUT_MS, 25000, 'N8N_TIMEOUT_MS');

    this.qdrantUrl = this.#normalizeUrl(
      envSource.QDRANT_URL || 'http://localhost:6333',
      'QDRANT_URL'
    );
    this.qdrantApiKey = String(envSource.QDRANT_API_KEY || '').trim() || undefined;
    this.qdrantCollection = String(envSource.QDRANT_COLLECTION || 'lueurfle_french_3072').trim();
    this.qdrantVectorSize = this.#parsePositiveInt(
      envSource.QDRANT_VECTOR_SIZE,
      3072,
      'QDRANT_VECTOR_SIZE'
    );

    this.maxPdfSizeMb = this.#parsePositiveInt(envSource.MAX_PDF_SIZE_MB, 15, 'MAX_PDF_SIZE_MB', 100);
    this.maxPdfSizeBytes = this.maxPdfSizeMb * 1024 * 1024;

    Object.freeze(this.corsOrigins);
    Object.freeze(this);
  }

  /**
   * @param {unknown} rawValue
   * @param {number} fallback
   * @param {string} name
   * @param {number} [max=Number.MAX_SAFE_INTEGER]
   * @returns {number}
   */
  #parsePositiveInt(rawValue, fallback, name, max = Number.MAX_SAFE_INTEGER) {
    if (rawValue === undefined || rawValue === null || String(rawValue).trim() === '') {
      return fallback;
    }
    const parsed = Number(rawValue);
    if (!Number.isInteger(parsed) || parsed <= 0 || parsed > max) {
      throw new AppError(
        `Invalid environment variable ${name}: "${rawValue}"`,
        500,
        'INVALID_ENV_CONFIG'
      );
    }
    return parsed;
  }

  /**
   * @param {string} rawOrigins
   * @returns {string[]}
   */
  #parseCorsOrigins(rawOrigins) {
    const list = String(rawOrigins)
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean);

    if (list.length === 0) {
      throw new AppError('CORS_ORIGIN must define at least one allowed origin.', 500, 'INVALID_ENV_CONFIG');
    }
    return list;
  }

  /**
   * @param {string} rawUrl
   * @param {string} name
   * @returns {string}
   */
  #normalizeUrl(rawUrl, name) {
    const trimmed = String(rawUrl || '').trim().replace(/\/+$/, '');
    try {
      const parsed = new URL(trimmed);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        throw new Error('Unsupported protocol');
      }
      return trimmed;
    } catch {
      throw new AppError(`Invalid URL in ${name}: "${rawUrl}"`, 500, 'INVALID_ENV_CONFIG');
    }
  }

  /**
   * @param {string} rawPath
   * @returns {string}
   */
  #normalizePath(rawPath) {
    const clean = String(rawPath || '').trim();
    return clean.startsWith('/') ? clean : `/${clean}`;
  }

  /**
   * @returns {boolean}
   */
  isProduction() {
    return this.nodeEnv === 'production';
  }
}
