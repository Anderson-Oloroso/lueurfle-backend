import { z } from 'zod';
import { ChatRequest } from '../models/chatRequest.model.js';
import { AppError } from '../utils/appError.js';

/**
 * Controlador HTTP orientado a objetos para conversaciones, niveles CEFR y sesiones.
 */
export class ChatController {
  static #sessionUpdateSchema = z.object({
    level: z.enum(['basico', 'intermedio', 'avanzado']).optional(),
    uiLanguage: z.enum(['es', 'en']).optional(),
    title: z.string().trim().min(1).max(80).optional()
  });

  /**
   * @param {object} deps
   * @param {import('../services/chat.service.js').ChatService} deps.chatService
   * @param {import('../services/sessionState.service.js').SessionStateService} deps.sessionStateService
   * @param {import('../services/oceanPersona.service.js').OceanPersonaService} deps.oceanPersonaService
   */
  constructor({ chatService, sessionStateService, oceanPersonaService }) {
    this.chatService = chatService;
    this.sessionStateService = sessionStateService;
    this.oceanPersonaService = oceanPersonaService;
  }

  /**
   * POST /api/chat
   */
  async sendMessage(req, res) {
    const chatRequest = ChatRequest.fromPayload(req.body);
    const result = await this.chatService.processTurn(chatRequest);
    res.status(200).json({ ok: true, data: result });
  }

  /**
   * GET /api/levels
   */
  getLevels(_req, res) {
    res.status(200).json({ ok: true, data: this.oceanPersonaService.getCatalog() });
  }

  /**
   * GET /api/sessions
   */
  listSessions(_req, res) {
    res.status(200).json({ ok: true, data: this.sessionStateService.listSessions() });
  }

  /**
   * POST /api/sessions
   */
  createSession(req, res) {
    const parsed = ChatController.#sessionUpdateSchema.safeParse(req.body || {});
    if (!parsed.success) {
      throw new AppError('Invalid session preferences.', 400, 'VALIDATION_ERROR', parsed.error.flatten().fieldErrors);
    }
    const session = this.sessionStateService.getOrCreateSession(parsed.data);
    res.status(201).json({ ok: true, data: session });
  }

  /**
   * GET /api/sessions/:id/messages
   */
  getSessionMessages(req, res) {
    const session = this.sessionStateService.getSession(req.params.id);
    if (!session) {
      throw new AppError(`Session "${req.params.id}" not found.`, 404, 'SESSION_NOT_FOUND');
    }
    res.status(200).json({ ok: true, data: session });
  }

  /**
   * PATCH /api/sessions/:id
   */
  updateSession(req, res) {
    const parsed = ChatController.#sessionUpdateSchema.safeParse(req.body || {});
    if (!parsed.success) {
      throw new AppError('Invalid session update payload.', 400, 'VALIDATION_ERROR', parsed.error.flatten().fieldErrors);
    }
    const updated = this.sessionStateService.updateSession(req.params.id, parsed.data);
    if (!updated) {
      throw new AppError(`Session "${req.params.id}" not found.`, 404, 'SESSION_NOT_FOUND');
    }
    res.status(200).json({ ok: true, data: updated });
  }

  /**
   * DELETE /api/sessions/:id
   */
  deleteSession(req, res) {
    const deleted = this.sessionStateService.deleteSession(req.params.id);
    if (!deleted) {
      throw new AppError(`Session "${req.params.id}" not found.`, 404, 'SESSION_NOT_FOUND');
    }
    res.status(200).json({ ok: true, data: { deleted: true, id: req.params.id } });
  }
}
