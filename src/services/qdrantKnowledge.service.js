/**
 * Servicio OOP que gestiona e inspecciona la única base de conocimiento vectorial: Qdrant.
 */
export class QdrantKnowledgeService {
  static DEFAULT_INDEXES = Object.freeze([
    { field_name: 'level', field_schema: 'keyword' },
    { field_name: 'topic', field_schema: 'keyword' },
    { field_name: 'source', field_schema: 'keyword' },
    { field_name: 'keywords', field_schema: 'keyword' }
  ]);

  /**
   * @param {object} params
   * @param {import('@qdrant/js-client-rest').QdrantClient} params.client
   * @param {string} params.collectionName
   * @param {number} [params.vectorSize=3072]
   */
  constructor({ client, collectionName, vectorSize = 3072 }) {
    this.client = client;
    this.collectionName = collectionName;
    this.vectorSize = vectorSize;
  }

  /**
   * Crea la colección e índices de payload si todavía no existen en Qdrant.
   * @returns {Promise<{ created: boolean, collectionName: string, indexes: string[] }>}
   */
  async ensureCollection() {
    const { collections = [] } = await this.client.getCollections();
    const exists = collections.some((col) => col.name === this.collectionName);
    let created = false;

    if (!exists) {
      await this.client.createCollection(this.collectionName, {
        vectors: {
          size: this.vectorSize,
          distance: 'Cosine'
        },
        hnsw_config: {
          m: 16,
          ef_construct: 100
        }
      });
      created = true;
    }

    const indexes = [];
    for (const indexDef of QdrantKnowledgeService.DEFAULT_INDEXES) {
      await this.client.createPayloadIndex(this.collectionName, {
        field_name: indexDef.field_name,
        field_schema: indexDef.field_schema,
        wait: true
      });
      indexes.push(indexDef.field_name);
    }

    return {
      created,
      collectionName: this.collectionName,
      indexes
    };
  }

  /**
   * Obtiene el estado de salud y conteo de vectores de la colección en Qdrant.
   * @returns {Promise<object>}
   */
  async getCollectionStatus() {
    try {
      const { collections = [] } = await this.client.getCollections();
      const exists = collections.some((col) => col.name === this.collectionName);
      if (!exists) {
        return {
          reachable: true,
          exists: false,
          collectionName: this.collectionName,
          pointsCount: 0,
          indexedVectorsCount: 0,
          status: 'missing'
        };
      }

      const info = await this.client.getCollection(this.collectionName);
      return {
        reachable: true,
        exists: true,
        collectionName: this.collectionName,
        pointsCount: info?.points_count ?? 0,
        indexedVectorsCount: info?.indexed_vectors_count ?? 0,
        status: info?.status || 'green'
      };
    } catch (error) {
      return {
        reachable: false,
        exists: false,
        collectionName: this.collectionName,
        pointsCount: 0,
        indexedVectorsCount: 0,
        status: 'unreachable',
        error: error.message
      };
    }
  }

  /**
   * Lista las fuentes documentales únicas indexadas en Qdrant (vía payload).
   * @param {number} [limit=50]
   * @returns {Promise<Array<{ source: string, level: string }>>}
   */
  async listIndexedSources(limit = 50) {
    try {
      const response = await this.client.scroll(this.collectionName, {
        limit,
        with_payload: true,
        with_vector: false
      });

      const seen = new Map();
      for (const point of response?.points || []) {
        const source = point?.payload?.source || point?.payload?.metadata?.source;
        if (!source) continue;
        const level = point?.payload?.level || point?.payload?.metadata?.level || 'general';
        if (!seen.has(source)) {
          seen.set(source, { source, level });
        }
      }
      return Array.from(seen.values());
    } catch {
      return [];
    }
  }
}
