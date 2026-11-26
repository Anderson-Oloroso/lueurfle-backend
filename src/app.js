import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { AppError } from './utils/appError.js';
import { EnvConfig } from './config/env.js';
import { QdrantClientFactory } from './config/qdrant.js';
import { OceanPersonaService } from './services/oceanPersona.service.js';
import { GuardrailService } from './services/guardrail.service.js';
import { QdrantKnowledgeService } from './services/qdrantKnowledge.service.js';
import { SessionStateService } from './services/sessionState.service.js';
import { N8nWebhookService } from './services/n8nWebhook.service.js';
import { ChatService } from './services/chat.service.js';
import { DocumentService } from './services/document.service.js';
import { ChatController } from './controllers/chat.controller.js';
import { DocumentController } from './controllers/document.controller.js';
import { PdfValidatorMiddleware } from './middlewares/pdfValidator.middleware.js';
import { ErrorHandlerMiddleware } from './middlewares/errorHandler.middleware.js';
import { ChatRoutes } from './routes/chat.routes.js';
import { DocumentRoutes } from './routes/document.routes.js';
import { ApiRouter } from './routes/index.js';

/**
 * Ensamblador principal Express 5 orientado a objetos para lueurfle-backend.
 * Única base de conocimiento: Qdrant (sin dependencias SQL).
 */
export class App {
  /**
   * @param {object} [deps]
   * @param {EnvConfig} [deps.envConfig]
   * @param {QdrantKnowledgeService} [deps.qdrantKnowledgeService]
   * @param {N8nWebhookService} [deps.n8nWebhookService]
   * @param {SessionStateService} [deps.sessionStateService]
   */
  constructor(deps = {}) {
    this.envConfig = deps.envConfig || new EnvConfig();
    this.expressApp = express();

    const qdrantClient =
      deps.qdrantClient || new QdrantClientFactory(this.envConfig).createClient();

    this.qdrantKnowledgeService =
      deps.qdrantKnowledgeService ||
      new QdrantKnowledgeService({
        client: qdrantClient,
        collectionName: this.envConfig.qdrantCollection,
        vectorSize: this.envConfig.qdrantVectorSize
      });

    this.sessionStateService = deps.sessionStateService || new SessionStateService();
    this.oceanPersonaService = deps.oceanPersonaService || new OceanPersonaService();
    this.guardrailService = deps.guardrailService || new GuardrailService();
    this.n8nWebhookService =
      deps.n8nWebhookService ||
      new N8nWebhookService({
        baseUrl: this.envConfig.n8nBaseUrl,
        chatWebhookPath: this.envConfig.n8nChatWebhookPath,
        ingestWebhookPath: this.envConfig.n8nIngestWebhookPath,
        timeoutMs: this.envConfig.n8nTimeoutMs
      });

    this.chatService = new ChatService({
      sessionStateService: this.sessionStateService,
      oceanPersonaService: this.oceanPersonaService,
      guardrailService: this.guardrailService,
      n8nWebhookService: this.n8nWebhookService
    });

    this.documentService = new DocumentService({
      n8nWebhookService: this.n8nWebhookService,
      qdrantKnowledgeService: this.qdrantKnowledgeService,
      collectionName: this.envConfig.qdrantCollection
    });

    this.#configureMiddlewares();
    this.#configureRoutes();
    this.#configureErrorHandling();
  }

  #configureMiddlewares() {
    this.expressApp.use(helmet());
    this.expressApp.use(
      cors({
        origin: (origin, callback) => {
          if (!origin || this.envConfig.corsOrigins.includes(origin) || this.envConfig.corsOrigins.includes('*')) {
            return callback(null, true);
          }
          return callback(new AppError(`Origin not allowed by CORS: ${origin}`, 403, 'CORS_FORBIDDEN'));
        },
        credentials: false
      })
    );
    this.expressApp.use(
      rateLimit({
        windowMs: this.envConfig.rateLimitWindowMs,
        max: this.envConfig.rateLimitMax,
        standardHeaders: true,
        legacyHeaders: false
      })
    );
    this.expressApp.use(express.json({ limit: '1mb' }));
  }

  #configureRoutes() {
    this.expressApp.get('/health', (_req, res) => {
      res.status(200).json({
        ok: true,
        status: 'ok',
        service: 'lueurfle-backend',
        knowledgeBase: 'qdrant'
      });
    });

    this.expressApp.get('/health/ready', async (_req, res) => {
      const qdrant = await this.qdrantKnowledgeService.getCollectionStatus();
      res.status(200).json({
        ok: true,
        service: 'lueurfle-backend',
        qdrant
      });
    });

    const chatController = new ChatController({
      chatService: this.chatService,
      sessionStateService: this.sessionStateService,
      oceanPersonaService: this.oceanPersonaService
    });
    const documentController = new DocumentController(this.documentService);
    const pdfValidator = new PdfValidatorMiddleware({
      maxPdfSizeBytes: this.envConfig.maxPdfSizeBytes
    });

    const apiRouter = new ApiRouter({
      chatRoutes: new ChatRoutes(chatController),
      documentRoutes: new DocumentRoutes({ documentController, pdfValidator })
    });

    this.expressApp.use('/api', apiRouter.router);
  }

  #configureErrorHandling() {
    const errorHandler = new ErrorHandlerMiddleware(this.envConfig.isProduction());
    this.expressApp.use((req, res, next) => errorHandler.notFound(req, res, next));
    this.expressApp.use((err, req, res, next) => errorHandler.handle(err, req, res, next));
  }

  /**
   * @returns {import('express').Express}
   */
  getExpressInstance() {
    return this.expressApp;
  }
}
