#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { executeHttpRequest } from './services/httpExecutor.js';
import { getEnvironments } from './services/storageService.js';

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (command !== 'run' || !args[1]) {
    console.log(`
Courier Headless CLI Test Suite Runner

Usage:
  courier run <collection-file.json> [--env <environment-name>]

Examples:
  node server/cli.js run ./courier-data/collections/sample.json --env Development
    `);
    process.exit(1);
  }

  const collectionPath = path.resolve(process.cwd(), args[1]);
  if (!fs.existsSync(collectionPath)) {
    console.error(`Error: Collection file not found at ${collectionPath}`);
    process.exit(1);
  }

  let envName = null;
  const envIdx = args.indexOf('--env');
  if (envIdx !== -1 && args[envIdx + 1]) {
    envName = args[envIdx + 1];
  }

  // Load environment variables if specified
  const envVariables = {};
  if (envName) {
    const allEnvs = getEnvironments();
    const matchedEnv = allEnvs.find(e => e.name.toLowerCase() === envName.toLowerCase());
    if (matchedEnv && Array.isArray(matchedEnv.variables)) {
      matchedEnv.variables.forEach(v => {
        if (v.enabled) envVariables[v.key] = v.value;
      });
      console.log(`[Courier CLI] Using environment: "${matchedEnv.name}" (${Object.keys(envVariables).length} variables)`);
    } else {
      console.warn(`[Courier CLI] Warning: Environment "${envName}" not found. Running with empty environment.`);
    }
  }

  const rawCollection = fs.readFileSync(collectionPath, 'utf8');
  const collection = JSON.parse(rawCollection);

  console.log(`\n======================================================`);
  console.log(`🚀 Running Suite: ${collection.name || path.basename(collectionPath)}`);
  console.log(`======================================================\n`);

  let totalRequests = 0;
  let passedAssertions = 0;
  let failedAssertions = 0;

  for (const req of collection.requests || []) {
    totalRequests++;
    process.stdout.write(`• [${req.method}] ${req.name} ... `);

    const result = await executeHttpRequest(req, envVariables);
    const isSuccess = result.status >= 200 && result.status < 400;
    const statusColor = isSuccess ? '\x1b[32m' : '\x1b[31m';
    const reset = '\x1b[0m';

    console.log(`${statusColor}${result.status} ${result.statusText}${reset} (${result.timeMs}ms)`);

    if (result.testResults && result.testResults.length > 0) {
      for (const t of result.testResults) {
        if (t.passed) {
          passedAssertions++;
          console.log(`    \x1b[32m✓ ${t.name}\x1b[0m`);
        } else {
          failedAssertions++;
          console.log(`    \x1b[31m✗ ${t.name} -> ${t.message}\x1b[0m`);
        }
      }
    }
  }

  console.log(`\n------------------------------------------------------`);
  console.log(`Summary:`);
  console.log(`  Requests executed: ${totalRequests}`);
  console.log(`  Assertions passed: \x1b[32m${passedAssertions}\x1b[0m`);
  console.log(`  Assertions failed: ${failedAssertions > 0 ? '\x1b[31m' : '\x1b[32m'}${failedAssertions}\x1b[0m`);
  console.log(`======================================================\n`);

  if (failedAssertions > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

main().catch(err => {
  console.error('[Courier CLI Error]:', err);
  process.exit(1);
});

