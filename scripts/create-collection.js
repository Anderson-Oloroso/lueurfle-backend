import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { EnvConfig } from '../src/config/env.js';
import { QdrantClientFactory } from '../src/config/qdrant.js';
import { QdrantKnowledgeService } from '../src/services/qdrantKnowledge.service.js';

/**
 * Provisionador CLI orientado a objetos para crear la colección vectorial de Lueur en Qdrant.
 */
export class QdrantCollectionManager {
  /**
   * @param {object} [options]
   * @param {QdrantKnowledgeService} [options.knowledgeService]
   * @param {EnvConfig} [options.envConfig]
   * @param {{ log?: Function }} [options.logger=console]
   */
  constructor({ knowledgeService, envConfig, logger = console } = {}) {
    this.envConfig = envConfig || new EnvConfig();
    if (knowledgeService) {
      this.knowledgeService = knowledgeService;
    } else {
      const client = new QdrantClientFactory(this.envConfig).createClient();
      this.knowledgeService = new QdrantKnowledgeService({
        client,
        collectionName: this.envConfig.qdrantCollection,
        vectorSize: this.envConfig.qdrantVectorSize
      });
    }
    this.logger = logger;
  }

  /**
   * @returns {Promise<{ created: boolean, collectionName: string, indexes: string[] }>}
   */
  async setup() {
    const result = await this.knowledgeService.ensureCollection();
    const action = result.created ? 'created' : 'already exists';
    this.logger.log?.(
      `[Qdrant] Collection "${result.collectionName}" ${action}. Payload indexes ensured: ${result.indexes.join(', ')}.`
    );
    return result;
  }
}

const isExecutedDirectly =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isExecutedDirectly) {
  try {
    const manager = new QdrantCollectionManager();
    await manager.setup();
  } catch (error) {
    console.error(`[Qdrant] Collection setup failed: ${error.message}`);
    process.exitCode = 1;
  }
}
