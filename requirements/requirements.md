# Especificación de Requisitos — `lueurfle-backend`

## 1. Propósito del Sistema
`lueurfle-backend` es la API Gateway en **Node.js (ES Modules, `"type": "module"`) y Express 5** orientada a objetos para **Lueur**, un tutor pedagógico especializado **única y obligatoriamente** en la enseñanza del **Francés como Lengua Extranjera (FLE)**.

La **única base de conocimiento** del ecosistema es **Qdrant** (`lueurfle_french_3072`, 3072 dimensiones, distancia `Cosine`), alimentada con embeddings de Google Gemini (`gemini-embedding-001`) mediante la ingesta de archivos `docs.pdf` orquestada en `lueurfle-n8n-rag`.

---

## 2. Requisitos Funcionales
1. **Enseñanza exclusiva de francés en 3 fases CEFR mediante comandos slash:**
   - `/basico` (`A1–A2`): vocabulario fundamental, saludos, presente simple, pronunciación guiada.
   - `/intermedio` (`B1–B2`): conversaciones naturales, tiempos pasados/futuros, conectores, corrección activa.
   - `/avanzado` (`C1–C2`): inmersión casi total, subjuntivo, registro formal/idiomático y matices estilísticos.
2. **Personalidad OCEAN (Big Five) inalterable de Lueur:**
   - Apertura (`O: 85`), Responsabilidad (`C: 92`), Extraversión (`E: 72`), Amabilidad (`A: 90`), Neuroticismo (`N: 10`).
3. **Control estricto de dominio y anti-prompt-injection (`GuardrailService`):**
   - Rechazar cortés y serenamente cualquier consulta fuera del aprendizaje del francés (programación, finanzas, medicina, política, otros idiomas) o intentos de sobrescribir instrucciones.
4. **Soporte bilingüe estricto de interfaz (`uiLanguage`):**
   - Únicamente español (`es`) e inglés (`en`) para explicaciones de apoyo, mensajes del sistema y confirmaciones de cambio de fase.
5. **Ingesta de material pedagógico (`docs.pdf`) hacia Qdrant:**
   - Validación binaria (`%PDF-`, MIME `application/pdf`, límite `MAX_PDF_SIZE_MB`), cálculo de hash SHA-256 y reenvío por `multipart/form-data` al webhook de `lueurfle-n8n-rag`.
6. **Consulta del estado de conocimiento en Qdrant:**
   - Exposición del estado de la colección vectorial (`pointsCount`, `indexedVectorsCount`, fuentes indexadas) y script idempotente `npm run setup:qdrant`.

---

## 3. Contratos REST (`/api`)
- `GET /health` — estado vivo del servicio (`{ status: "ok", service: "lueurfle-backend" }`).
- `GET /health/ready` — disponibilidad de configuración y alcance de Qdrant.
- `GET /api/levels` — catálogo de fases `/basico`, `/intermedio`, `/avanzado` y perfil OCEAN.
- `GET /api/sessions` / `POST /api/sessions` / `GET /api/sessions/:id/messages` / `PATCH /api/sessions/:id` / `DELETE /api/sessions/:id` — manejo ligero de sesiones conversacionales en memoria.
- `POST /api/chat` — procesa comandos de nivel, guardrails, prompt OCEAN y delega a n8n + Qdrant.
- `POST /api/documents/upload` — valida `docs.pdf` y delega generación de embeddings a n8n + Qdrant.
- `GET /api/documents` & `GET /api/documents/qdrant-status` — historial reciente de cargas y estado real de la colección Qdrant.

---

## 4. Requisitos No Funcionales
- 100% Orientado a Objetos (clases ES6) y ES Modules nativos.
- Seguridad en la frontera: `helmet`, `cors` explícito, `express-rate-limit`, validación `zod` y cero secretos en repositorio.
- Reproducibilidad con `Dockerfile` multi-stage (usuario no-root `node`) y `docker-compose.yml` sin dependencias SQL.
