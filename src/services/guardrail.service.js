/**
 * Guardrail determinista de dominio para asegurar que Lueur enseñe únicamente francés
 * y resista intentos de prompt injection o desvío temático.
 */
export class GuardrailService {
  static #INJECTION_PATTERNS = [
    /ignore\s+(all\s+)?(previous|prior|above)\s+instructions?/i,
    /ignora\s+(todas\s+)?(las\s+)?instrucciones/i,
    /olvidate\s+de\s+tus\s+reglas/i,
    /system\s*prompt/i,
    /reveal\s+your\s+(instructions|prompt)/i,
    /jailbreak/i,
    /\bdan\s+mode\b/i,
    /bypass\s+(your\s+)?(rules|safety|guardrails)/i,
    /(act|pretend|behave)\s+as\s+(?!a\s+french|un\s+professeur|tutor\s+de\s+frances)/i,
    /actua\s+como\s+(?!tutor|profesor|nativo\s+frances)/i
  ];

  static #OFF_TOPIC_PATTERNS = [
    /\b(javascript|typescript|python|java|c\+\+|react|angular|node\.?js|mysql|postgres|sql\s+query|docker\s+compose|kubernetes|html\s+code|css\s+grid)\b/i,
    /\b(programa|programar|codigo\s+fuente|algoritmo|base\s+de\s+datos|api\s+rest)\b/i,
    /\b(bitcoin|ethereum|trading|criptomoneda|bolsa\s+de\s+valores|hipoteca)\b/i,
    /\b(receta\s+medica|diagnostico\s+medico|dosis\s+de\s+medicamento|abogado|demanda\s+legal)\b/i,
    /\b(enseñame|teach\s+me|aprender|learn)\s+(aleman|german|japones|japanese|chino|mandarin|italiano|portugues|ruso|coreano)\b/i,
    /\b(escribe\s+un\s+codigo|write\s+a\s+script|hackear|exploit|vulnerabilidad)\b/i
  ];

  static #FRENCH_CONTEXT_ANCHORS = [
    /\b(frances|french|français|francais|fle|bonjour|merci|salut|conjug|verbo|verb|grammaire|gramatica|prononciation|pronunciacion|vocabulario|vocabulary|subjonctif|subjuntivo|passe\s+compose|imparfait)\b/i,
    /\/(basico|intermedio|avanzado)\b/i
  ];

  /**
   * Evalúa un mensaje limpio antes de enviarlo al agente RAG en n8n.
   * @param {string} message
   * @returns {{ allowed: boolean, category: 'ok'|'prompt_injection'|'off_topic', reason: string|null }}
   */
  inspect(message) {
    const text = String(message || '').trim();
    if (!text) {
      return { allowed: true, category: 'ok', reason: null };
    }

    for (const pattern of GuardrailService.#INJECTION_PATTERNS) {
      if (pattern.test(text)) {
        return {
          allowed: false,
          category: 'prompt_injection',
          reason: 'Prompt injection attempt detected.'
        };
      }
    }

    const hasFrenchAnchor = GuardrailService.#FRENCH_CONTEXT_ANCHORS.some((p) => p.test(text));
    if (!hasFrenchAnchor) {
      for (const pattern of GuardrailService.#OFF_TOPIC_PATTERNS) {
        if (pattern.test(text)) {
          return {
            allowed: false,
            category: 'off_topic',
            reason: 'Message is outside the French tutoring domain.'
          };
        }
      }
    }

    return { allowed: true, category: 'ok', reason: null };
  }
}
