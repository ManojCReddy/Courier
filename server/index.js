import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { initStorage, getCollections, saveCollection, deleteCollection, getEnvironments, saveEnvironment, deleteEnvironment } from './services/storageService.js';
import { executeHttpRequest } from './services/httpExecutor.js';
import { parseCurl } from './services/curlParser.js';
import { processCopilotChat } from './services/copilotService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const PORT = process.env.PORT || 4174;
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
  res.json({ status: 'ok', name: 'Courier Local API Server', version: '0.1.1' });
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
    res.json({ success });
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

// Courier Copilot AI Assistant
app.post('/api/copilot/chat', async (req, res) => {
  try {
    const { messages, mode, context, config } = req.body;
    const result = await processCopilotChat({ messages, mode, context, config });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Start Server
app.listen(PORT, () => {
  console.log(`[Courier Core Engine] Local server running on http://localhost:${PORT}`);
  console.log(`[Courier Core Engine] Storage initialized in ./courier-data/`);
});

