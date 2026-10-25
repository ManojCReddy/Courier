import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { initStorage, getCollections, saveCollection, deleteCollection, getEnvironments, saveEnvironment, deleteEnvironment, saveSpec, getSpec, listSpecs, deleteSpec } from './services/storageService.js';
import { executeHttpRequest } from './services/httpExecutor.js';
import { parseCurl } from './services/curlParser.js';
import { parseSpecText, detectSpecVersion, previewSpec, buildCollection, buildApiMap, newSpecId } from './services/openapi.js';
import { checkContract } from './services/contractService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const PORT = process.env.PORT || 4174;
const HOST = '127.0.0.1';
const distPath = path.resolve(__dirname, '../dist');

// Middleware
app.use(cors());
app.use(express.json({ limit: '20mb' }));

if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get(/^(?!\/api).*$/, (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

// Initialize local filesystem storage
initStorage();

// Health Check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', name: 'Courier Local API Server', version: '0.2.3' });
});

// HTTP Request Execution
app.post('/api/http/execute', async (req, res) => {
  try {
    const { requestConfig, environment, settings } = req.body;
    if (!requestConfig) {
      return res.status(400).json({ error: 'Missing requestConfig payload' });
    }
    const result = await executeHttpRequest(requestConfig, environment || {}, settings || {});
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Collections CRUD
app.get('/api/collections', (req, res) => {
  try {
    const collections = getCollections();
    res.json(collections);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/collections', (req, res) => {
  try {
    const collection = saveCollection(req.body);
    res.json(collection);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/collections/:id', (req, res) => {
  try {
    const success = deleteCollection(req.params.id);
    // Keep the saved spec while any remaining collection (e.g. a duplicate) still links to it.
    const stillReferenced = getCollections().some(c => JSON.stringify(c).includes(`"specId":"${req.params.id}"`));
    if (!stillReferenced) deleteSpec(req.params.id);
    res.json({ success });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// OpenAPI / Swagger import
function loadSpecDocument(content) {
  const doc = parseSpecText(content);
  detectSpecVersion(doc);
  return doc;
}

app.post('/api/openapi/preview', (req, res) => {
  try {
    const doc = loadSpecDocument(req.body?.content);
    res.json(previewSpec(doc));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/openapi/import', (req, res) => {
  try {
    const { content, name, baseUrl, filename } = req.body || {};
    const doc = loadSpecDocument(content);
    const specId = newSpecId();
    const collection = buildCollection(doc, specId, { name: name?.trim() || undefined, baseUrl: baseUrl?.trim() || undefined });
    saveSpec(specId, {
      name: collection.name,
      version: detectSpecVersion(doc).label,
      importedAt: new Date().toISOString(),
      source: filename || null,
      doc,
    });
    saveCollection(collection);
    res.json({ collection, summary: previewSpec(doc) });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/specs', (req, res) => {
  try {
    res.json(listSpecs());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/specs/:id/map', (req, res) => {
  try {
    const spec = getSpec(req.params.id);
    if (!spec) return res.status(404).json({ error: 'Specification not found' });
    res.json({ id: spec.id, name: spec.name, ...buildApiMap(spec.doc) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/specs/:id/contract', (req, res) => {
  try {
    const spec = getSpec(req.params.id);
    if (!spec) return res.status(404).json({ error: 'Specification not found' });
    const { method, path: opPath, status, data } = req.body || {};
    if (!method || !opPath) return res.status(400).json({ error: 'method and path are required' });
    res.json(checkContract(spec.doc, { method, path: opPath, status, data }));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Environments CRUD
app.get('/api/environments', (req, res) => {
  try {
    const environments = getEnvironments();
    res.json(environments);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/environments', (req, res) => {
  try {
    const environment = saveEnvironment(req.body);
    res.json(environment);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/environments/:id', (req, res) => {
  try {
    const success = deleteEnvironment(req.params.id);
    res.json({ success });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// cURL Import / Parse
app.post('/api/curl/parse', (req, res) => {
  try {
    const { curl } = req.body;
    const parsed = parseCurl(curl);
    res.json(parsed);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Start Server
const server = app.listen(PORT, HOST, () => {
  console.log(`[Courier Core Engine] Local server running on http://${HOST}:${PORT}`);
  console.log(`[Courier Core Engine] Storage initialized in ./courier-data/`);
});

server.on('error', (error) => {
  if (error && error.code === 'EADDRINUSE') {
    console.warn(`[Courier Core Engine] Port ${PORT} is already in use. Reusing the running local server.`);
  } else {
    console.error('[Courier Core Engine] Server error:', error);
  }
});

