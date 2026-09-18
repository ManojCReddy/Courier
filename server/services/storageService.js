import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const DATA_DIR = path.resolve(process.cwd(), 'courier-data');
const COLLECTIONS_DIR = path.join(DATA_DIR, 'collections');
const ENVIRONMENTS_DIR = path.join(DATA_DIR, 'environments');

// Ensure directories exist
function ensureDirs() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(COLLECTIONS_DIR)) fs.mkdirSync(COLLECTIONS_DIR, { recursive: true });
  if (!fs.existsSync(ENVIRONMENTS_DIR)) fs.mkdirSync(ENVIRONMENTS_DIR, { recursive: true });
}

// Seed default samples if empty
export function initStorage() {
  ensureDirs();

  const collections = getCollections();
  if (collections.length === 0) {
    seedDefaultData();
  }
}

export function getCollections() {
  ensureDirs();
  const files = fs.readdirSync(COLLECTIONS_DIR).filter(f => f.endsWith('.json'));
  return files.map(file => {
    try {
      const raw = fs.readFileSync(path.join(COLLECTIONS_DIR, file), 'utf8');
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }).filter(Boolean);
}

export function saveCollection(collection) {
  ensureDirs();
  if (!collection.id) {
    collection.id = crypto.randomUUID();
  }
  const filePath = path.join(COLLECTIONS_DIR, `${collection.id}.json`);
  fs.writeFileSync(filePath, JSON.stringify(collection, null, 2), 'utf8');
  return collection;
}

export function deleteCollection(id) {
  ensureDirs();
  const filePath = path.join(COLLECTIONS_DIR, `${id}.json`);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
    return true;
  }
  return false;
}

export function getEnvironments() {
  ensureDirs();
  const files = fs.readdirSync(ENVIRONMENTS_DIR).filter(f => f.endsWith('.json'));
  return files.map(file => {
    try {
      const raw = fs.readFileSync(path.join(ENVIRONMENTS_DIR, file), 'utf8');
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }).filter(Boolean);
}

export function saveEnvironment(environment) {
  ensureDirs();
  if (!environment.id) {
    environment.id = crypto.randomUUID();
  }
  const filePath = path.join(ENVIRONMENTS_DIR, `${environment.id}.json`);
  fs.writeFileSync(filePath, JSON.stringify(environment, null, 2), 'utf8');
  return environment;
}

export function deleteEnvironment(id) {
  ensureDirs();
  const filePath = path.join(ENVIRONMENTS_DIR, `${id}.json`);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
    return true;
  }
  return false;
}

function seedDefaultData() {
  const defaultEnv = {
    id: 'env-default',
    name: 'Development',
    variables: [
      { key: 'baseUrl', value: 'https://jsonplaceholder.typicode.com', enabled: true, isSecret: false },
      { key: 'apiKey', value: 'secret_dev_key_123', enabled: true, isSecret: true },
      { key: 'userId', value: '1', enabled: true, isSecret: false },
    ]
  };
  saveEnvironment(defaultEnv);

  const sampleCollection = {
    id: 'col-sample-1',
    name: 'Sample API Suite',
    description: 'Starter local-first test suite demonstrating GET, POST, variable interpolation, and assertions',
    requests: [
      {
        id: 'req-1',
        name: 'Get Users List',
        method: 'GET',
        url: '{{baseUrl}}/users',
        params: [
          { key: 'limit', value: '5', enabled: true },
        ],
        headers: [
          { key: 'Accept', value: 'application/json', enabled: true },
        ],
        auth: { type: 'none' },
        bodyType: 'none',
        body: '',
        assertions: [
          { id: 'a-1', name: 'Status code is 200', type: 'STATUS_CODE_EQUALS', expected: '200', enabled: true },
          { id: 'a-2', name: 'Response time under 1500ms', type: 'RESPONSE_TIME_LESS_THAN', expected: '1500', enabled: true },
        ]
      },
      {
        id: 'req-2',
        name: 'Get Single User by ID',
        method: 'GET',
        url: '{{baseUrl}}/users/{{userId}}',
        params: [],
        headers: [
          { key: 'Accept', value: 'application/json', enabled: true },
        ],
        auth: { type: 'none' },
        bodyType: 'none',
        body: '',
        assertions: [
          { id: 'a-3', name: 'Status is 2xx', type: 'STATUS_IS_2XX', expected: '', enabled: true },
          { id: 'a-4', name: 'User has name property', type: 'JSON_PROPERTY_EXISTS', target: 'name', expected: '', enabled: true },
        ]
      },
      {
        id: 'req-3',
        name: 'Create New Post',
        method: 'POST',
        url: '{{baseUrl}}/posts',
        params: [],
        headers: [
          { key: 'Content-Type', value: 'application/json', enabled: true },
        ],
        auth: {
          type: 'bearer',
          bearerToken: '{{apiKey}}'
        },
        bodyType: 'json',
        body: JSON.stringify({
          title: "Automated API Test from Courier",
          body: "Running local-first test suites offline with dynamic uuid {{$guid}}",
          userId: 1
        }, null, 2),
        assertions: [
          { id: 'a-5', name: 'Created status is 201', type: 'STATUS_CODE_EQUALS', expected: '201', enabled: true },
          { id: 'a-6', name: 'Post has ID assigned', type: 'JSON_PROPERTY_EXISTS', target: 'id', expected: '', enabled: true },
        ]
      }
    ]
  };
  saveCollection(sampleCollection);
}

