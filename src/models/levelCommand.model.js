/**
 * Modelo de comandos pedagógicos de fase para Lueur (/basico, /intermedio, /avanzado).
 */
export class LevelCommand {
  static LEVELS = Object.freeze(['basico', 'intermedio', 'avanzado']);

  static METADATA = Object.freeze({
    basico: Object.freeze({
      code: 'basico',
      command: '/basico',
      cefr: 'A1-A2',
      labelEs: 'Básico',
      labelEn: 'Basic',
      summaryEs: 'Vocabulario cotidiano, saludos, presente y pronunciación guiada.',
      summaryEn: 'Everyday vocabulary, greetings, present tense, and guided pronunciation.'
    }),
    intermedio: Object.freeze({
      code: 'intermedio',
      command: '/intermedio',
      cefr: 'B1-B2',
      labelEs: 'Intermedio',
      labelEn: 'Intermediate',
      summaryEs: 'Diálogos naturales, passé composé/imparfait/futur y conectores.',
      summaryEn: 'Natural dialogues, passé composé/imparfait/futur, and logical connectors.'
    }),
    avanzado: Object.freeze({
      code: 'avanzado',
      command: '/avanzado',
      cefr: 'C1-C2',
      labelEs: 'Avanzado',
      labelEn: 'Advanced',
      summaryEs: 'Inmersión en francés, subjuntivo, registro formal e idiomático.',
      summaryEn: 'French immersion, subjunctive mood, formal/idiomatic register, and nuance.'
    })
  });

  /**
   * Verifica si un código de nivel es válido.
   * @param {string} level
   * @returns {boolean}
   */
  static isValidLevel(level) {
    return LevelCommand.LEVELS.includes(String(level || '').toLowerCase());
  }

  /**
   * Normaliza un nivel con fallback seguro a 'basico'.
   * @param {string} [level]
   * @returns {'basico'|'intermedio'|'avanzado'}
   */
  static normalizeLevel(level) {
    const candidate = String(level || '').trim().toLowerCase();
    return LevelCommand.isValidLevel(candidate) ? candidate : 'basico';
  }

  /**
   * Parsea comandos slash al inicio del mensaje del estudiante.
   * @param {string} rawMessage
   * @returns {{
   *   hasCommand: boolean,
   *   isUnknownCommand: boolean,
   *   isCommandOnly: boolean,
   *   command: string|null,
   *   level: 'basico'|'intermedio'|'avanzado'|null,
   *   cleanMessage: string
   * }}
   */
  static parse(rawMessage) {
    const trimmed = String(rawMessage || '').trim();
    if (!trimmed.startsWith('/')) {
      return {
        hasCommand: false,
        isUnknownCommand: false,
        isCommandOnly: false,
        command: null,
        level: null,
        cleanMessage: trimmed
      };
    }

    const match = trimmed.match(/^\/([a-zA-ZÀ-ÿ0-9_-]+)(?:\s+([\s\S]*))?$/);
    if (!match) {
      return {
        hasCommand: false,
        isUnknownCommand: true,
        isCommandOnly: false,
        command: trimmed.split(/\s+/)[0] || null,
        level: null,
        cleanMessage: trimmed
      };
    }

    const token = match[1]
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
    const rest = (match[2] || '').trim();

    if (!LevelCommand.isValidLevel(token)) {
      return {
        hasCommand: true,
        isUnknownCommand: true,
        isCommandOnly: rest.length === 0,
        command: `/${match[1].toLowerCase()}`,
        level: null,
        cleanMessage: rest || trimmed
      };
    }

    return {
      hasCommand: true,
      isUnknownCommand: false,
      isCommandOnly: rest.length === 0,
      command: `/${token}`,
      level: token,
      cleanMessage: rest
    };
  }
}
