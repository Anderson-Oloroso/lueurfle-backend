import { QdrantClient } from '@qdrant/js-client-rest';

/**
 * Fábrica orientada a objetos para construir clientes Qdrant desacoplados.
 */
export class QdrantClientFactory {
  /**
   * @param {import('./env.js').EnvConfig} envConfig
   */
  constructor(envConfig) {
    this.envConfig = envConfig;
  }

  /**
   * Crea una nueva instancia del cliente REST de Qdrant.
   * @returns {QdrantClient}
   */
  createClient() {
    return new QdrantClient({
      url: this.envConfig.qdrantUrl,
      ...(this.envConfig.qdrantApiKey ? { apiKey: this.envConfig.qdrantApiKey } : {})
    });
  }
}
