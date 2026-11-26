# `lueurfle-backend`

> API Gateway en **Node.js (ESM `"type": "module"`, 100% Orientado a Objetos)** y **Express 5** para **Lueur**, tutor pedagógico especializado única y obligatoriamente en la enseñanza del **francés (FLE)** con personalidad **OCEAN**, comandos de fase (`/basico`, `/intermedio`, `/avanzado`) y **Qdrant como única base de conocimiento vectorial**.

---

## 🎯 Objetivo

Proveer una capa backend modular que valide entradas, aplique guardrails contra temas fuera del francés y *prompt injection*, gestione sesiones ligeras e idiomas de soporte (`es` / `en`), valide archivos `docs.pdf` por cabecera binaria (`%PDF-`) y conecte con **n8n + Qdrant** para ingesta y recuperación RAG.

---

## 🛠️ Tecnologías

- **Node.js 20+ / 22+ / 25+** (`"type": "module"`, programación Orientada a Objetos con clases ES6)
- **Express 5** + `helmet` + `cors` + `express-rate-limit` + `zod` + `multer`
- **Qdrant** (`@qdrant/js-client-rest`, única base de conocimiento: colección `lueurfle_french_3072`, 3072 dims, distancia `Cosine`)
- **n8n Webhooks** (`POST /webhook/chat-french` y `POST /webhook/ingest-pdf`)
- **Docker** (multi-stage non-root) & **Docker Compose**
- **Pruebas:** `node:test` + colección HTTP reproducible en `bruno/lueurfle/`

---

## 📂 Árbol de Directorios

```text
lueurfle-backend/
├── bruno/lueurfle/                         # Colección HTTP reproducible
├── requirements/requirements.md            # Especificación funcional y de contratos
├── scripts/create-collection.js            # Script OOP idempotente para crear colección en Qdrant
├── src/
│   ├── config/                             # EnvConfig, QdrantClientFactory
│   ├── controllers/                        # ChatController, DocumentController
│   ├── middlewares/                        # ErrorHandlerMiddleware, PdfValidatorMiddleware
│   ├── models/                             # LevelCommand, ChatRequest
│   ├── routes/                             # ChatRoutes, DocumentRoutes, ApiRouter
│   ├── services/                           # OceanPersonaService, GuardrailService, QdrantKnowledgeService, SessionStateService, N8nWebhookService, ChatService, DocumentService
│   ├── utils/                              # AppError
│   ├── app.js                              # Clase App
│   └── server.js                           # Clase Server + graceful shutdown
├── tests/
│   ├── unit/                               # Pruebas unitarias de dominio, servicios y Qdrant
│   └── integration/                        # Pruebas HTTP reales sobre Express 5
├── .env.example
├── docker-compose.yml
├── Dockerfile
├── package.json
└── README.md
```

---

## 🌐 Endpoints Principales

- `GET /health` y `GET /health/ready`
- `GET /api/levels` — fases `/basico` (A1–A2), `/intermedio` (B1–B2), `/avanzado` (C1–C2) y matriz OCEAN
- `GET /api/sessions`, `POST /api/sessions`, `GET /api/sessions/:id/messages`, `PATCH /api/sessions/:id`, `DELETE /api/sessions/:id`
- `POST /api/chat` — procesa comandos de nivel, guardrails y consulta RAG en n8n + Qdrant (`uiLanguage`: `'es' | 'en'`)
- `POST /api/documents/upload` — valida `docs.pdf` (`%PDF-`) y envía a n8n para embeddings en Qdrant
- `GET /api/documents` y `GET /api/documents/qdrant-status`

---

## 🚀 Cómo Ejecutarlo

### Sin Docker
```bash
cp .env.example .env
npm install
npm run setup:qdrant
npm test
npm run dev
```

### Con Docker Compose
```bash
cp .env.example .env
docker compose up -d --build
```

---

## 👤 Autoría

- **Autor:** Henrik Anderson Oloroso García (`Anderson-Oloroso`)
- **Licencia:** [MIT](./LICENSE)
