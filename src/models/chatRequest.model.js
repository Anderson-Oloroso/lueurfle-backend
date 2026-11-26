import { z } from 'zod';
import { AppError } from '../utils/appError.js';
import { LevelCommand } from './levelCommand.model.js';

/**
 * DTO validado para peticiones entrantes al endpoint de chat de Lueur.
 */
export class ChatRequest {
  static #schema = z.object({
    sessionId: z.string().trim().min(3).max(100).optional(),
    message: z
      .string({ required_error: 'message is required' })
      .transform((val) => val.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim())
      .refine((val) => val.length >= 1, 'message cannot be empty')
      .refine((val) => val.length <= 2000, 'message exceeds 2000 characters'),
    level: z
      .enum(['basico', 'intermedio', 'avanzado'])
      .optional(),
    uiLanguage: z.enum(['es', 'en']).optional().default('es')
  });

  /**
   * @param {object} data
   */
  constructor({ sessionId, message, level, uiLanguage }) {
    this.sessionId = sessionId;
    this.message = message;
    this.level = level;
    this.uiLanguage = uiLanguage;
    this.parsedCommand = LevelCommand.parse(message);
    Object.freeze(this);
  }

  /**
   * Valida y construye una instancia de ChatRequest.
   * @param {unknown} rawBody
   * @returns {ChatRequest}
   */
  static fromPayload(rawBody) {
    const parsed = ChatRequest.#schema.safeParse(rawBody);
    if (!parsed.success) {
      throw new AppError(
        'Invalid chat payload.',
        400,
        'VALIDATION_ERROR',
        parsed.error.flatten().fieldErrors
      );
    }
    return new ChatRequest(parsed.data);
  }
}
