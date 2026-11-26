import { App } from './app.js';

/**
 * Ciclo de vida HTTP orientado a objetos con apagado controlado (graceful shutdown).
 */
export class Server {
  /**
   * @param {App} [app]
   */
  constructor(app = new App()) {
    this.app = app;
    this.httpServer = null;
  }

  /**
   * Inicia la escucha en el puerto configurado.
   * @returns {Promise<import('node:http').Server>}
   */
  start() {
    const port = this.app.envConfig.port;
    return new Promise((resolve) => {
      this.httpServer = this.app.getExpressInstance().listen(port, () => {
        console.log(
          `[lueurfle-backend] Lueur API running on http://localhost:${port} (knowledge base: Qdrant -> ${this.app.envConfig.qdrantCollection})`
        );
        resolve(this.httpServer);
      });
    });
  }

  /**
   * Cierra conexiones HTTP limpiamente ante señales del sistema.
   * @returns {Promise<void>}
   */
  stop() {
    return new Promise((resolve, reject) => {
      if (!this.httpServer) return resolve();
      this.httpServer.close((err) => {
        if (err) return reject(err);
        return resolve();
      });
    });
  }

  registerShutdownSignals() {
    const shutdown = async (signal) => {
      console.log(`[lueurfle-backend] Received ${signal}, shutting down...`);
      await this.stop();
      process.exit(0);
    };
    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
  }
}

const server = new Server();
server.registerShutdownSignals();
await server.start();
