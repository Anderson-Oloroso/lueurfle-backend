import { LevelCommand } from '../models/levelCommand.model.js';

/**
 * Orquestador principal de conversación para Lueur (fases CEFR, OCEAN, guardrails y n8n + Qdrant).
 */
export class ChatService {
  /**
   * @param {object} deps
   * @param {import('./sessionState.service.js').SessionStateService} deps.sessionStateService
   * @param {import('./oceanPersona.service.js').OceanPersonaService} deps.oceanPersonaService
   * @param {import('./guardrail.service.js').GuardrailService} deps.guardrailService
   * @param {import('./n8nWebhook.service.js').N8nWebhookService} deps.n8nWebhookService
   */
  constructor({
    sessionStateService,
    oceanPersonaService,
    guardrailService,
    n8nWebhookService
  }) {
    this.sessionStateService = sessionStateService;
    this.oceanPersonaService = oceanPersonaService;
    this.guardrailService = guardrailService;
    this.n8nWebhookService = n8nWebhookService;
  }

  /**
   * Procesa un turno de chat de un estudiante.
   * @param {import('../models/chatRequest.model.js').ChatRequest} chatRequest
   * @returns {Promise<object>}
   */
  async processTurn(chatRequest) {
    const session = this.sessionStateService.getOrCreateSession({
      sessionId: chatRequest.sessionId,
      level: chatRequest.level,
      uiLanguage: chatRequest.uiLanguage
    });

    const uiLanguage = chatRequest.uiLanguage || session.uiLanguage || 'es';
    const parsed = chatRequest.parsedCommand;

    if (parsed.isUnknownCommand) {
      const refusal = this.oceanPersonaService.getGuardrailRefusal({
        uiLanguage,
        level: session.currentLevel,
        category: 'unknown_command',
        unknownCommand: parsed.command
      });
      this.sessionStateService.appendMessage(session.id, {
        role: 'user',
        content: chatRequest.message,
        levelUsed: session.currentLevel,
        commandUsed: parsed.command
      });
      this.sessionStateService.appendMessage(session.id, {
        role: 'assistant',
        content: refusal,
        levelUsed: session.currentLevel,
        isBlocked: true
      });
      return this.#formatResponse({
        session,
        reply: refusal,
        level: session.currentLevel,
        uiLanguage,
        commandApplied: null,
        blocked: true,
        category: 'unknown_command'
      });
    }

    const activeLevel = parsed.level || chatRequest.level || session.currentLevel;
    this.sessionStateService.updateSession(session.id, {
      level: activeLevel,
      uiLanguage
    });

    this.sessionStateService.appendMessage(session.id, {
      role: 'user',
      content: chatRequest.message,
      levelUsed: activeLevel,
      commandUsed: parsed.command
    });

    if (parsed.isCommandOnly && parsed.level) {
      const switchReply = this.oceanPersonaService.getLevelSwitchConfirmation({
        level: activeLevel,
        uiLanguage
      });
      this.sessionStateService.appendMessage(session.id, {
        role: 'assistant',
        content: switchReply,
        levelUsed: activeLevel,
        commandUsed: parsed.command
      });
      return this.#formatResponse({
        session,
        reply: switchReply,
        level: activeLevel,
        uiLanguage,
        commandApplied: parsed.command,
        blocked: false,
        category: 'level_switch'
      });
    }

    const effectiveMessage = parsed.cleanMessage || chatRequest.message;
    const guardrail = this.guardrailService.inspect(effectiveMessage);
    if (!guardrail.allowed) {
      const refusal = this.oceanPersonaService.getGuardrailRefusal({
        uiLanguage,
        level: activeLevel,
        category: guardrail.category
      });
      this.sessionStateService.appendMessage(session.id, {
        role: 'assistant',
        content: refusal,
        levelUsed: activeLevel,
        isBlocked: true
      });
      return this.#formatResponse({
        session,
        reply: refusal,
        level: activeLevel,
        uiLanguage,
        commandApplied: parsed.command,
        blocked: true,
        category: guardrail.category
      });
    }

    const systemPrompt = this.oceanPersonaService.buildSystemPrompt({
      level: activeLevel,
      uiLanguage
    });

    const upstream = await this.n8nWebhookService.sendChatTurn({
      sessionId: session.id,
      message: effectiveMessage,
      rawMessage: chatRequest.message,
      level: activeLevel,
      command: LevelCommand.METADATA[activeLevel].command,
      cefr: LevelCommand.METADATA[activeLevel].cefr,
      uiLanguage,
      systemPrompt
    });

    const replyText =
      String(upstream?.reply || upstream?.output || upstream?.text || '').trim() ||
      this.oceanPersonaService.getLevelSwitchConfirmation({ level: activeLevel, uiLanguage });
    const sources = Array.isArray(upstream?.sources) ? upstream.sources : [];

    this.sessionStateService.appendMessage(session.id, {
      role: 'assistant',
      content: replyText,
      levelUsed: activeLevel,
      commandUsed: parsed.command,
      sources
    });

    return this.#formatResponse({
      session,
      reply: replyText,
      level: activeLevel,
      uiLanguage,
      commandApplied: parsed.command,
      blocked: false,
      category: 'rag_tutor',
      sources
    });
  }

  /**
   * @param {object} params
   * @returns {object}
   */
  #formatResponse({
    session,
    reply,
    level,
    uiLanguage,
    commandApplied,
    blocked,
    category,
    sources = []
  }) {
    const meta = LevelCommand.METADATA[LevelCommand.normalizeLevel(level)];
    return {
      tutor: 'Lueur',
      sessionId: session.id,
      level: meta.code,
      cefr: meta.cefr,
      command: meta.command,
      commandApplied,
      uiLanguage,
      blocked,
      category,
      reply,
      sources
    };
  }
}
