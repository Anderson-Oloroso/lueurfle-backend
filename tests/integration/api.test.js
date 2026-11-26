import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { App } from '../../src/app.js';
import { EnvConfig } from '../../src/config/env.js';

function startFakeN8nServer() {
  const server = http.createServer(async (req, res) => {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const bodyText = Buffer.concat(chunks).toString('utf8');

    res.setHeader('Content-Type', 'application/json');
    if (req.url === '/webhook/chat-french') {
      const payload = JSON.parse(bodyText || '{}');
      res.end(
        JSON.stringify({
          reply: `Lueur (${payload.level}): Très bien !`,
          sources: ['docs.pdf']
        })
      );
      return;
    }

    if (req.url === '/webhook/ingest-pdf') {
      res.end(JSON.stringify({ ok: true, status: 'indexed' }));
      return;
    }

    res.statusCode = 404;
    res.end(JSON.stringify({ ok: false }));
  });

  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      resolve({ server, baseUrl: `http://127.0.0.1:${port}` });
    });
  });
}

class StubQdrantClient {
  async getCollections() {
    return { collections: [{ name: 'lueurfle_french_3072' }] };
  }
  async getCollection() {
    return { status: 'green', points_count: 24, indexed_vectors_count: 24 };
  }
  async scroll() {
    return { points: [{ id: 1, payload: { source: 'docs.pdf', level: 'basico' } }] };
  }
}

test('API integration: health, levels, chat commands, guardrails, PDF validation, and Qdrant status', async () => {
  const fakeN8n = await startFakeN8nServer();
  const envConfig = new EnvConfig({
    NODE_ENV: 'test',
    PORT: '3000',
    CORS_ORIGIN: 'http://localhost:5500',
    N8N_BASE_URL: fakeN8n.baseUrl,
    QDRANT_URL: 'http://127.0.0.1:6333',
    QDRANT_COLLECTION: 'lueurfle_french_3072'
  });

  const app = new App({ envConfig, qdrantClient: new StubQdrantClient() });
  const apiServer = await new Promise((resolve) => {
    const s = app.getExpressInstance().listen(0, '127.0.0.1', () => resolve(s));
  });
  const { port } = apiServer.address();
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    const healthRes = await fetch(`${baseUrl}/health`);
    const healthJson = await healthRes.json();
    assert.equal(healthRes.status, 200);
    assert.equal(healthJson.knowledgeBase, 'qdrant');

    const levelsRes = await fetch(`${baseUrl}/api/levels`);
    const levelsJson = await levelsRes.json();
    assert.equal(levelsRes.status, 200);
    assert.equal(levelsJson.data.tutor, 'Lueur');
    assert.equal(levelsJson.data.levels.length, 3);

    const switchRes = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: '/intermedio', uiLanguage: 'es' })
    });
    const switchJson = await switchRes.json();
    assert.equal(switchRes.status, 200);
    assert.equal(switchJson.data.level, 'intermedio');

    const chatRes = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: switchJson.data.sessionId,
        message: 'Bonjour, comment conjuguer aller ?',
        uiLanguage: 'en'
      })
    });
    const chatJson = await chatRes.json();
    assert.equal(chatRes.status, 200);
    assert.equal(chatJson.data.uiLanguage, 'en');
    assert.match(chatJson.data.reply, /Lueur \(intermedio\)/);

    const badLangRes = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'Bonjour', uiLanguage: 'de' })
    });
    assert.equal(badLangRes.status, 400);

    const formValid = new FormData();
    formValid.append(
      'file',
      new Blob(['%PDF-1.4\n%LueurFLE sample\n%%EOF'], { type: 'application/pdf' }),
      'docs.pdf'
    );
    formValid.append('levelTag', 'basico');
    const uploadOk = await fetch(`${baseUrl}/api/documents/upload`, {
      method: 'POST',
      body: formValid
    });
    const uploadOkJson = await uploadOk.json();
    assert.equal(uploadOk.status, 201);
    assert.equal(uploadOkJson.data.status, 'indexed');

    const formFake = new FormData();
    formFake.append(
      'file',
      new Blob(['NOT_A_PDF_HEADER'], { type: 'application/pdf' }),
      'fake.pdf'
    );
    const uploadFake = await fetch(`${baseUrl}/api/documents/upload`, {
      method: 'POST',
      body: formFake
    });
    assert.equal(uploadFake.status, 400);

    const qdrantStatusRes = await fetch(`${baseUrl}/api/documents/qdrant-status`);
    const qdrantStatusJson = await qdrantStatusRes.json();
    assert.equal(qdrantStatusRes.status, 200);
    assert.equal(qdrantStatusJson.data.pointsCount, 24);

    const notFoundRes = await fetch(`${baseUrl}/api/non-existent`);
    assert.equal(notFoundRes.status, 404);
  } finally {
    await new Promise((resolve) => apiServer.close(resolve));
    await new Promise((resolve) => fakeN8n.server.close(resolve));
  }
});
