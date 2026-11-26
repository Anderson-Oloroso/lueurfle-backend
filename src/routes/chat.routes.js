import { Router } from 'express';

/**
 * Enrutador OOP para chat, niveles pedagógicos y sesiones de Lueur.
 */
export class ChatRoutes {
  /**
   * @param {import('../controllers/chat.controller.js').ChatController} chatController
   */
  constructor(chatController) {
    this.controller = chatController;
    this.router = Router();
    this.#register();
  }

  #register() {
    this.router.post('/chat', (req, res) => this.controller.sendMessage(req, res));
    this.router.get('/levels', (req, res) => this.controller.getLevels(req, res));
    this.router.get('/sessions', (req, res) => this.controller.listSessions(req, res));
    this.router.post('/sessions', (req, res) => this.controller.createSession(req, res));
    this.router.get('/sessions/:id/messages', (req, res) =>
      this.controller.getSessionMessages(req, res)
    );
    this.router.patch('/sessions/:id', (req, res) => this.controller.updateSession(req, res));
    this.router.delete('/sessions/:id', (req, res) => this.controller.deleteSession(req, res));
  }
}
