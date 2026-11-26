import crypto from 'node:crypto';
import { LevelCommand } from '../models/levelCommand.model.js';

/**
 * Almacén ligero en memoria para sesiones de chat activas sin depender de base SQL.
 * Mantiene nivel pedagógico, idioma UI (es|en) e historial acotado por sesión.
 */
export class SessionStateService {
  /**
   * @param {object} [options]
   * @param {number} [options.maxSessions=200]
   * @param {number} [options.maxMessagesPerSession=80]
   */
  constructor({ maxSessions = 200, maxMessagesPerSession = 80 } = {}) {
    this.maxSessions = maxSessions;
    this.maxMessagesPerSession = maxMessagesPerSession;
    this.sessions = new Map();
  }

  /**
   * Crea o recupera una sesión por ID.
   * @param {object} [params]
   * @param {string} [params.sessionId]
   * @param {string} [params.title]
   * @param {'basico'|'intermedio'|'avanzado'} [params.level='basico']
   * @param {'es'|'en'} [params.uiLanguage='es']
   * @returns {object}
   */
  getOrCreateSession({ sessionId, title, level = 'basico', uiLanguage = 'es' } = {}) {
    if (sessionId && this.sessions.has(sessionId)) {
      return this.sessions.get(sessionId);
    }

    const id = sessionId || crypto.randomUUID();
    const now = new Date().toISOString();
    const session = {
      id,
      title: title || (uiLanguage === 'en' ? 'French Practice' : 'Práctica de francés'),
      currentLevel: LevelCommand.normalizeLevel(level),
      uiLanguage: uiLanguage === 'en' ? 'en' : 'es',
      createdAt: now,
      updatedAt: now,
      messages: []
    };

    if (this.sessions.size >= this.maxSessions) {
      const oldestKey = this.sessions.keys().next().value;
      this.sessions.delete(oldestKey);
    }

    this.sessions.set(id, session);
    return session;
  }

  /**
   * @param {string} sessionId
   * @returns {object|null}
   */
  getSession(sessionId) {
    return this.sessions.get(sessionId) || null;
  }

  /**
   * Lista resúmenes de sesiones ordenadas de más reciente a más antigua.
   * @returns {Array<object>}
   */
  listSessions() {
    return Array.from(this.sessions.values())
      .map((s) => ({
        id: s.id,
        title: s.title,
        currentLevel: s.currentLevel,
        uiLanguage: s.uiLanguage,
        messageCount: s.messages.length,
        createdAt: s.createdAt,
        updatedAt: s.updatedAt
      }))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  /**
   * Actualiza preferencias de sesión.
   * @param {string} sessionId
   * @param {object} updates
   * @returns {object|null}
   */
  updateSession(sessionId, updates = {}) {
    const session = this.sessions.get(sessionId);
    if (!session) return null;

    if (updates.level && LevelCommand.isValidLevel(updates.level)) {
      session.currentLevel = updates.level;
    }
    if (updates.uiLanguage === 'es' || updates.uiLanguage === 'en') {
      session.uiLanguage = updates.uiLanguage;
    }
    if (typeof updates.title === 'string' && updates.title.trim()) {
      session.title = updates.title.trim().slice(0, 80);
    }
    session.updatedAt = new Date().toISOString();
    return session;
  }

  /**
   * Registra un mensaje dentro de la sesión.
   * @param {string} sessionId
   * @param {object} entry
   * @returns {object}
   */
  appendMessage(sessionId, entry) {
    const session = this.getOrCreateSession({ sessionId });
    const messageRecord = {
      id: crypto.randomUUID(),
      role: entry.role,
      content: entry.content,
      levelUsed: entry.levelUsed || session.currentLevel,
      commandUsed: entry.commandUsed || null,
      isBlocked: Boolean(entry.isBlocked),
      sources: Array.isArray(entry.sources) ? entry.sources : [],
      createdAt: new Date().toISOString()
    };

    session.messages.push(messageRecord);
    if (session.messages.length > this.maxMessagesPerSession) {
      session.messages.shift();
    }
    session.updatedAt = messageRecord.createdAt;
    return messageRecord;
  }

  /**
   * @param {string} sessionId
   * @returns {boolean}
   */
  deleteSession(sessionId) {
    return this.sessions.delete(sessionId);
  }
}
