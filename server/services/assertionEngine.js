/**
 * Evaluates test assertions against the HTTP response
 */
export function runAssertions(assertions, response) {
  if (!Array.isArray(assertions) || assertions.length === 0) {
    return [];
  }

  const results = [];

  for (const assertion of assertions) {
    if (!assertion.enabled) continue;

    const { name, type, expected, target } = assertion;
    let passed = false;
    let actual = null;
    let message = '';

    try {
      switch (type) {
        case 'STATUS_CODE_EQUALS': {
          actual = response.status;
          const expectedStatus = parseInt(expected, 10);
          passed = actual === expectedStatus;
          message = passed
            ? `Status code is ${expectedStatus}`
            : `Expected status ${expectedStatus} but got ${actual}`;
          break;
        }

        case 'STATUS_IS_2XX': {
          actual = response.status;
          passed = actual >= 200 && actual < 300;
          message = passed
            ? `Status ${actual} is 2xx success`
            : `Expected 2xx status, received ${actual}`;
          break;
        }

        case 'RESPONSE_TIME_LESS_THAN': {
          actual = response.timeMs;
          const maxTime = parseInt(expected, 10);
          passed = actual < maxTime;
          message = passed
            ? `Response time ${actual}ms is under ${maxTime}ms`
            : `Response time ${actual}ms exceeded ${maxTime}ms limit`;
          break;
        }

        case 'BODY_CONTAINS': {
          const bodyStr = typeof response.data === 'string'
            ? response.data
            : JSON.stringify(response.data);
          actual = bodyStr;
          passed = bodyStr.includes(expected);
          message = passed
            ? `Response body contains "${expected}"`
            : `Response body does not contain "${expected}"`;
          break;
        }

        case 'JSON_PROPERTY_EXISTS': {
          if (typeof response.data !== 'object' || response.data === null) {
            passed = false;
            message = 'Response data is not valid JSON';
          } else {
            const keys = (target || expected || '').split('.');
            let curr = response.data;
            let exists = true;
            for (const k of keys) {
              if (curr && typeof curr === 'object' && k in curr) {
                curr = curr[k];
              } else {
                exists = false;
                break;
              }
            }
            passed = exists;
            actual = exists ? 'Exists' : 'Not found';
            message = passed
              ? `JSON property "${target || expected}" exists`
              : `JSON property "${target || expected}" not found`;
          }
          break;
        }

        case 'JSON_PROPERTY_EQUALS': {
          if (typeof response.data !== 'object' || response.data === null) {
            passed = false;
            message = 'Response data is not valid JSON';
          } else {
            const keys = (target || '').split('.');
            let curr = response.data;
            for (const k of keys) {
              if (curr && typeof curr === 'object' && k in curr) {
                curr = curr[k];
              } else {
                curr = undefined;
                break;
              }
            }
            actual = curr;
            passed = String(curr) === String(expected);
            message = passed
              ? `Property "${target}" equals ${expected}`
              : `Property "${target}" expected ${expected}, got ${curr}`;
          }
          break;
        }

        default:
          passed = false;
          message = `Unknown assertion type: ${type}`;
      }
    } catch (err) {
      passed = false;
      message = `Assertion error: ${err.message}`;
    }

    results.push({
      id: assertion.id,
      name: name || message,
      passed,
      message,
      actual,
      expected,
    });
  }

  return results;
}

