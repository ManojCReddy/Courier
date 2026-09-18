import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveVariables, resolveDeep } from '../services/variableResolver.js';
import { parseCurl } from '../services/curlParser.js';
import { runAssertions } from '../services/assertionEngine.js';

test('variableResolver substitutes environment variables and dynamic generators', () => {
  const env = { baseUrl: 'https://api.test.com', token: 'xyz123' };
  
  const url = resolveVariables('{{baseUrl}}/users', env);
  assert.equal(url, 'https://api.test.com/users');

  const auth = resolveVariables('Bearer {{token}}', env);
  assert.equal(auth, 'Bearer xyz123');

  const withUuid = resolveVariables('item-{{$guid}}', env);
  assert.match(withUuid, /^item-[0-9a-f-]{36}$/i);

  const deep = resolveDeep({ a: '{{baseUrl}}', b: ['{{token}}'] }, env);
  assert.equal(deep.a, 'https://api.test.com');
  assert.equal(deep.b[0], 'xyz123');
});

test('curlParser accurately extracts method, url, headers, and body', () => {
  const curl = `curl -X POST "https://api.example.com/items" \\
    -H "Authorization: Bearer secret_token" \\
    -H "Content-Type: application/json" \\
    -d '{"name": "Widget", "qty": 10}'`;

  const parsed = parseCurl(curl);
  assert.equal(parsed.method, 'POST');
  assert.equal(parsed.url, 'https://api.example.com/items');
  assert.equal(parsed.auth.type, 'bearer');
  assert.equal(parsed.auth.bearerToken, 'secret_token');
  assert.equal(parsed.bodyType, 'json');
  assert.equal(JSON.parse(parsed.body).name, 'Widget');
});

test('assertionEngine correctly verifies HTTP responses', () => {
  const response = {
    status: 200,
    timeMs: 150,
    data: { id: 42, username: 'alice', active: true },
    headers: { 'content-type': 'application/json' }
  };

  const assertions = [
    { id: '1', type: 'STATUS_CODE_EQUALS', expected: '200', enabled: true },
    { id: '2', type: 'STATUS_IS_2XX', expected: '', enabled: true },
    { id: '3', type: 'RESPONSE_TIME_LESS_THAN', expected: '300', enabled: true },
    { id: '4', type: 'JSON_PROPERTY_EXISTS', target: 'username', expected: '', enabled: true },
    { id: '5', type: 'JSON_PROPERTY_EQUALS', target: 'id', expected: '42', enabled: true },
  ];

  const results = runAssertions(assertions, response);
  assert.equal(results.length, 5);
  for (const r of results) {
    assert.equal(r.passed, true, `Assertion failed: ${r.name}`);
  }
});

