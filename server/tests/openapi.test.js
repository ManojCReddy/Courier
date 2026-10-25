import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseSpecText,
  previewSpec,
  buildCollection,
  buildApiMap,
} from '../services/openapi.js';
import { checkContract } from '../services/contractService.js';
import { validateAgainstSchema, detectDrift } from '../services/schemaTools.js';

const OAS3_YAML = `
openapi: 3.0.3
info: { title: Pet Store, version: 1.0.0 }
servers:
  - url: https://{env}.petstore.test/v1
    variables: { env: { default: api } }
security:
  - bearerAuth: []
tags: [{ name: pets }]
paths:
  /pets:
    get:
      tags: [pets]
      summary: List pets
      parameters:
        - { name: limit, in: query, required: true, schema: { type: integer, example: 5 } }
        - { name: tag, in: query, schema: { type: string } }
      responses:
        '200':
          description: ok
          content:
            application/json:
              schema: { type: array, items: { $ref: '#/components/schemas/Pet' } }
    post:
      tags: [pets]
      summary: Create pet
      requestBody:
        required: true
        content:
          application/json:
            schema: { $ref: '#/components/schemas/NewPet' }
      responses:
        '201':
          description: created
          content:
            application/json:
              schema: { $ref: '#/components/schemas/Pet' }
  /pets/{petId}:
    parameters:
      - { name: petId, in: path, required: true, schema: { type: integer } }
    get:
      summary: Get pet
      security:
        - apiKey: []
      responses:
        '200':
          description: ok
          content:
            application/json:
              schema: { $ref: '#/components/schemas/Pet' }
        default:
          description: error
          content:
            application/json:
              schema: { $ref: '#/components/schemas/Error' }
components:
  securitySchemes:
    bearerAuth: { type: http, scheme: bearer }
    apiKey: { type: apiKey, in: header, name: X-API-Key }
  schemas:
    NewPet:
      type: object
      required: [name]
      properties:
        name: { type: string, example: Rex }
        tag: { type: string }
    Pet:
      allOf:
        - $ref: '#/components/schemas/NewPet'
        - type: object
          required: [id]
          properties:
            id: { type: integer, format: int64 }
            owner: { $ref: '#/components/schemas/Owner' }
    Owner:
      type: object
      properties:
        name: { type: string }
        pets: { type: array, items: { $ref: '#/components/schemas/Pet' } }
    Error:
      type: object
      required: [message]
      properties:
        message: { type: string }
`;

const SWAGGER2 = JSON.stringify({
  swagger: '2.0',
  info: { title: 'Legacy', version: '1' },
  host: 'legacy.test',
  basePath: '/api',
  schemes: ['https'],
  securityDefinitions: { basic: { type: 'basic' } },
  security: [{ basic: [] }],
  paths: {
    '/users/{id}': {
      get: {
        tags: ['users'],
        parameters: [{ name: 'id', in: 'path', required: true, type: 'string' }],
        responses: { 200: { description: 'ok', schema: { $ref: '#/definitions/User' } } },
      },
      put: {
        tags: ['users'],
        parameters: [
          { name: 'id', in: 'path', required: true, type: 'string' },
          { name: 'body', in: 'body', required: true, schema: { $ref: '#/definitions/User' } },
        ],
        responses: { 204: { description: 'updated' } },
      },
    },
  },
  definitions: {
    User: { type: 'object', required: ['id'], properties: { id: { type: 'string' }, age: { type: 'integer' } } },
  },
});

test('parses OpenAPI 3 YAML and previews it', () => {
  const doc = parseSpecText(OAS3_YAML);
  const preview = previewSpec(doc);
  assert.equal(preview.version, 'OpenAPI 3.0.3');
  assert.equal(preview.counts.endpoints, 3);
  assert.equal(preview.counts.models, 4);
  assert.equal(preview.servers[0].url, 'https://api.petstore.test/v1');
  assert.deepEqual(preview.security.map(s => s.name).sort(), ['apiKey', 'bearerAuth']);
});

test('generates collections, folders, params, auth and example bodies from OpenAPI 3', () => {
  const doc = parseSpecText(OAS3_YAML);
  const col = buildCollection(doc, 'col-test');
  assert.equal(col.name, 'Pet Store');
  assert.equal(col.folders.length, 1);
  assert.equal(col.folders[0].name, 'pets');
  assert.equal(col.requests.length, 1);
  assert.equal(col.variables.find(v => v.key === 'baseUrl').value, 'https://api.petstore.test/v1');

  const list = col.folders[0].requests.find(r => r.name === 'List pets');
  assert.equal(list.url, '{{baseUrl}}/pets');
  assert.deepEqual(list.params.map(p => [p.key, p.value, p.enabled]), [['limit', '5', true], ['tag', 'string', false]]);
  assert.equal(list.auth.type, 'bearer');
  assert.deepEqual(list.openapi, { specId: 'col-test', method: 'GET', path: '/pets' });

  const create = col.folders[0].requests.find(r => r.name === 'Create pet');
  assert.equal(create.bodyType, 'json');
  assert.equal(JSON.parse(create.body).name, 'Rex');
  assert.equal(create.assertions[0].expected, '201');

  const get = col.requests[0];
  assert.equal(get.pathParams[0].key, 'petId');
  assert.equal(get.auth.type, 'apiKey');
  assert.equal(get.auth.apiKeyName, 'X-API-Key');
  assert.equal(get.auth.apiKeyPlacement, 'header');
});

test('imports Swagger 2.0 JSON including body, path params and basic auth', () => {
  const doc = parseSpecText(SWAGGER2);
  const col = buildCollection(doc, 'col-legacy');
  assert.equal(col.variables[0].value, 'https://legacy.test/api');
  const [get, put] = col.folders[0].requests;
  assert.equal(get.auth.type, 'basic');
  assert.equal(put.bodyType, 'json');
  assert.deepEqual(JSON.parse(put.body), { id: 'string', age: 0 });
});

test('rejects unsupported documents', () => {
  assert.throws(() => parseSpecText(''), /empty/);
  assert.throws(() => previewSpec(parseSpecText('hello: world')), /Not an OpenAPI/);
  assert.throws(() => previewSpec(parseSpecText('openapi: 2.5.0')), /Unsupported/);
});

test('API map links models to fields, references and endpoints', () => {
  const map = buildApiMap(parseSpecText(OAS3_YAML));
  const pet = map.models.find(m => m.name === 'Pet');
  assert.deepEqual(pet.fields.map(f => f.name).sort(), ['id', 'name', 'owner', 'tag']);
  assert.equal(pet.fields.find(f => f.name === 'id').required, true);
  assert.deepEqual(pet.refsOut.sort(), ['NewPet', 'Owner']);
  assert.deepEqual(pet.usedBy, ['Owner']);
  assert.ok(pet.endpoints.some(e => e.key === 'GET /pets' && e.direct));
  const owner = map.models.find(m => m.name === 'Owner');
  assert.ok(owner.endpoints.some(e => e.key === 'GET /pets' && !e.direct));
  const getPet = map.endpoints.find(e => e.key === 'GET /pets/{petId}');
  assert.deepEqual(getPet.responses.map(r => r.status), ['200', 'default']);
});

test('validator reports the exact path of mismatches', () => {
  const doc = parseSpecText(OAS3_YAML);
  const schema = { type: 'array', items: { $ref: '#/components/schemas/Pet' } };
  const errors = validateAgainstSchema(doc, schema, [
    { id: 1, name: 'ok' },
    { id: 'two', name: 'bad', owner: { name: 5 } },
    { name: 'noid' },
  ]);
  const byPath = Object.fromEntries(errors.map(e => [e.path, e.message]));
  assert.match(byPath['$[1].id'], /Expected integer but received string/);
  assert.match(byPath['$[1].owner.name'], /Expected string but received integer/);
  assert.match(byPath['$[2].id'], /Required property "id" is missing/);
  assert.equal(errors.length, 3);
});

test('contract drift reports added, missing and type-changed fields', () => {
  const doc = parseSpecText(OAS3_YAML);
  const result = checkContract(doc, {
    method: 'GET',
    path: '/pets/42',
    status: 200,
    data: { id: '42', name: 'Rex', color: 'brown', owner: { name: null } },
  });
  assert.equal(result.matched, true);
  assert.equal(result.operation, 'GET /pets/{petId}');
  assert.equal(result.validation.valid, false);
  assert.deepEqual(result.drift.added.map(a => a.path), ['$.color']);
  assert.deepEqual(result.drift.missing.map(m => m.path).sort(), ['$.owner.pets', '$.tag']);
  assert.deepEqual(result.drift.typeChanged.map(t => [t.path, t.expected, t.observed]).sort(), [
    ['$.id', 'integer', 'string'],
    ['$.owner.name', 'string', 'null'],
  ]);
});

test('drift collapses array element findings and handles unmatched operations', () => {
  const doc = parseSpecText(OAS3_YAML);
  const schema = { type: 'array', items: { $ref: '#/components/schemas/NewPet' } };
  const drift = detectDrift(doc, schema, [{ name: 'a', extra: 1 }, { name: 'b', extra: 2 }, { name: 'c' }]);
  assert.equal(drift.added.length, 1);
  assert.equal(drift.added[0].path, '$[].extra');
  assert.equal(drift.added[0].occurrences, 2);
  assert.deepEqual(drift.missing.map(m => [m.path, m.absentIn, m.of]), [['$[].tag', 3, 3]]);

  assert.equal(checkContract(doc, { method: 'GET', path: '/nope', status: 200, data: {} }).matched, false);
  const undocumented = checkContract(doc, { method: 'POST', path: '/pets', status: 500, data: {} });
  assert.equal(undocumented.validation.valid, false);
});

test('falls back to the default response schema', () => {
  const doc = parseSpecText(OAS3_YAML);
  const result = checkContract(doc, { method: 'GET', path: '/pets/1', status: 404, data: { message: 'nope' } });
  assert.equal(result.matchedStatus, 'default');
  assert.equal(result.validation.valid, true);
});
