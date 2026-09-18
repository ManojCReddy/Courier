/**
 * Parses raw cURL command string into structured Courier request
 */
export function parseCurl(curlString) {
  if (!curlString || typeof curlString !== 'string') {
    throw new Error('Empty or invalid cURL string');
  }

  // Normalize newlines and escape backslashes
  const cleanCmd = curlString
    .replace(/\\\r?\n/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // Basic regex tokenizing respecting quotes
  const tokens = [];
  let current = '';
  let inSingleQuote = false;
  let inDoubleQuote = false;

  for (let i = 0; i < cleanCmd.length; i++) {
    const char = cleanCmd[i];
    if (char === "'" && !inDoubleQuote) {
      inSingleQuote = !inSingleQuote;
    } else if (char === '"' && !inSingleQuote) {
      inDoubleQuote = !inDoubleQuote;
    } else if (char === ' ' && !inSingleQuote && !inDoubleQuote) {
      if (current.length > 0) {
        tokens.push(current);
        current = '';
      }
    } else {
      current += char;
    }
  }
  if (current.length > 0) tokens.push(current);

  if (tokens.length === 0 || tokens[0].toLowerCase() !== 'curl') {
    throw new Error('Command must start with curl');
  }

  let method = 'GET';
  let url = '';
  const headers = [];
  let body = '';
  let bodyType = 'none';
  let authType = 'none';
  let authToken = '';
  let basicUser = '';
  let basicPass = '';

  for (let i = 1; i < tokens.length; i++) {
    const token = tokens[i];

    if (token === '-X' || token === '--request') {
      method = (tokens[++i] || 'GET').toUpperCase();
    } else if (token === '-H' || token === '--header') {
      const headerLine = tokens[++i];
      if (headerLine) {
        const colonIndex = headerLine.indexOf(':');
        if (colonIndex > -1) {
          const key = headerLine.slice(0, colonIndex).trim();
          const value = headerLine.slice(colonIndex + 1).trim();
          
          // Check for Authorization header
          if (key.toLowerCase() === 'authorization') {
            if (value.toLowerCase().startsWith('bearer ')) {
              authType = 'bearer';
              authToken = value.slice(7).trim();
            }
          }
          headers.push({ key, value, enabled: true });
        }
      }
    } else if (token === '-d' || token === '--data' || token === '--data-raw' || token === '--data-binary') {
      const data = tokens[++i];
      if (data) {
        body = data;
        bodyType = 'raw';
        try {
          JSON.parse(data);
          bodyType = 'json';
        } catch {
          // keep as raw
        }
        if (method === 'GET') method = 'POST';
      }
    } else if (token === '-u' || token === '--user') {
      const creds = tokens[++i];
      if (creds) {
        const [u, p] = creds.split(':');
        authType = 'basic';
        basicUser = u || '';
        basicPass = p || '';
      }
    } else if (!token.startsWith('-') && !url) {
      // First non-flag token is usually URL
      url = token.replace(/^['"]|['"]$/g, '');
    }
  }

  return {
    method,
    url,
    headers,
    body,
    bodyType,
    auth: {
      type: authType,
      bearerToken: authToken,
      basicUsername: basicUser,
      basicPassword: basicPass
    }
  };
}

