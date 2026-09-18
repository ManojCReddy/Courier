import axios from 'axios';

/**
 * Courier Copilot AI Service
 * Supports Local Ollama (100% offline & air-gapped), Gemini BYOK, OpenAI BYOK, and Smart Offline Heuristics.
 */
export async function processCopilotChat({
  messages,
  mode = 'chat', // 'chat' | 'generate_request' | 'generate_tests' | 'diagnose_error'
  context = {},
  config = {}
}) {
  const {
    provider = 'auto', // 'local_ollama' | 'gemini' | 'openai' | 'auto'
    ollamaUrl = 'http://localhost:11434',
    ollamaModel = 'llama3',
    geminiKey = process.env.GEMINI_API_KEY || '',
    geminiModel = 'gemini-2.5-flash',
    openaiKey = process.env.OPENAI_API_KEY || '',
    openaiModel = 'gpt-4o-mini'
  } = config;

  // Prefer Gemini if key is provided or user explicitly requested Google AI mode
  const effectiveGeminiKey = geminiKey || process.env.GEMINI_API_KEY || '';

  // Build system prompt based on mode and request context
  const systemPrompt = buildSystemPrompt(mode, context);

  // 1. Google Gemini AI Mode
  if ((provider === 'gemini' || provider === 'google' || (provider === 'auto' && effectiveGeminiKey)) && effectiveGeminiKey) {
    try {
      const geminiResponse = await callGemini(effectiveGeminiKey, geminiModel, systemPrompt, messages);
      return {
        reply: geminiResponse,
        providerUsed: `Google Gemini (${geminiModel})`,
        isLocal: false,
        suggestions: extractStructuredSuggestions(geminiResponse, mode)
      };
    } catch (err) {
      console.warn('Gemini API call failed:', err.message);
    }
  }

  // 2. Local Ollama (Air-gapped)
  if (provider === 'local_ollama' || (provider === 'auto' && !effectiveGeminiKey && !openaiKey)) {
    try {
      const ollamaResponse = await callOllama(ollamaUrl, ollamaModel, systemPrompt, messages);
      if (ollamaResponse) {
        return {
          reply: ollamaResponse,
          providerUsed: `Local Ollama (${ollamaModel})`,
          isLocal: true,
          suggestions: extractStructuredSuggestions(ollamaResponse, mode)
        };
      }
    } catch {
      // If Ollama is not reachable, fall through
    }
  }

  if ((provider === 'openai' || (provider === 'auto' && openaiKey)) && openaiKey) {
    try {
      const openaiResponse = await callOpenAI(openaiKey, openaiModel, systemPrompt, messages);
      return {
        reply: openaiResponse,
        providerUsed: `OpenAI (${openaiModel})`,
        isLocal: false,
        suggestions: extractStructuredSuggestions(openaiResponse, mode)
      };
    } catch (err) {
      console.warn('OpenAI API call failed:', err.message);
    }
  }

  // Fallback to Smart Built-in Heuristic AI Engine
  const smartResult = generateSmartFallback(mode, context, messages);
  return {
    reply: smartResult.text,
    providerUsed: 'Courier Built-in Copilot (Offline Engine)',
    isLocal: true,
    suggestions: smartResult.suggestions || null
  };
}

function buildSystemPrompt(mode, context) {
  let prompt = `You are Courier Copilot, an expert AI assistant embedded inside the Courier API testing tool (an air-gapped, local-first Postman/Bruno alternative). 
You help developers design API requests, write test assertions, diagnose HTTP error responses, and debug payloads.
Respond concisely, accurately, and provide code/JSON when appropriate.\n`;

  if (context.currentRequest) {
    prompt += `\nCURRENT ACTIVE REQUEST:\n${JSON.stringify({
      method: context.currentRequest.method,
      url: context.currentRequest.url,
      headers: context.currentRequest.headers,
      body: context.currentRequest.body
    }, null, 2)}\n`;
  }

  if (context.currentResponse) {
    prompt += `\nLATEST HTTP RESPONSE:\n${JSON.stringify({
      status: context.currentResponse.status,
      timeMs: context.currentResponse.timeMs,
      headers: context.currentResponse.headers,
      data: context.currentResponse.data
    }, null, 2)}\n`;
  }

  if (mode === 'generate_tests') {
    prompt += `\nTASK: Generate realistic test assertions for this response in JSON format.
Format assertions as a JSON block:
\`\`\`json
{
  "assertions": [
    { "name": "...", "type": "STATUS_CODE_EQUALS", "expected": "200", "enabled": true },
    { "name": "...", "type": "RESPONSE_TIME_LESS_THAN", "expected": "1000", "enabled": true },
    { "name": "...", "type": "JSON_PROPERTY_EXISTS", "target": "property_name", "expected": "", "enabled": true }
  ]
}
\`\`\``;
  } else if (mode === 'diagnose_error') {
    prompt += `\nTASK: Diagnose why this HTTP response failed (status ${context.currentResponse?.status}). Explain the likely root cause and provide exact fixes for the developer.`;
  } else if (mode === 'generate_request') {
    prompt += `\nTASK: Generate a complete API request from the user's prompt. Provide it in JSON format:
\`\`\`json
{
  "method": "POST",
  "url": "https://api.example.com/v1/...",
  "headers": [{ "key": "Content-Type", "value": "application/json", "enabled": true }],
  "bodyType": "json",
  "body": "{ ... }"
}
\`\`\``;
  }

  return prompt;
}

async function callOllama(url, model, systemPrompt, messages) {
  const formattedMessages = [
    { role: 'system', content: systemPrompt },
    ...messages.map(m => ({ role: m.role, content: m.content }))
  ];

  const res = await axios.post(`${url}/api/chat`, {
    model,
    messages: formattedMessages,
    stream: false,
  }, { timeout: 15000 });

  return res.data?.message?.content || '';
}

async function callGemini(apiKey, model = 'gemini-2.5-flash', systemPrompt, messages) {
  const contents = [];
  
  // Attach user & model messages
  for (const m of messages) {
    contents.push({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }]
    });
  }

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const res = await axios.post(
    endpoint,
    {
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents,
    },
    { timeout: 25000 }
  );

  const candidate = res.data?.candidates?.[0];
  return candidate?.content?.parts?.[0]?.text || 'No response generated.';
}

async function callOpenAI(apiKey, model, systemPrompt, messages) {
  const formattedMessages = [
    { role: 'system', content: systemPrompt },
    ...messages.map(m => ({ role: m.role, content: m.content }))
  ];

  const res = await axios.post(
    'https://api.openai.com/v1/chat/completions',
    {
      model,
      messages: formattedMessages,
    },
    {
      headers: { Authorization: `Bearer ${apiKey}` },
      timeout: 20000
    }
  );

  return res.data?.choices?.[0]?.message?.content || '';
}

function extractStructuredSuggestions(text, mode) {
  try {
    const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/);
    if (jsonMatch && jsonMatch[1]) {
      return JSON.parse(jsonMatch[1]);
    }
  } catch {
    // ignore
  }
  return null;
}

/**
 * Smart Offline Heuristic AI Engine
 * Provides instant value without any external network access or LLM key required!
 */
function generateSmartFallback(mode, context, messages) {
  const lastMsg = messages[messages.length - 1]?.content || '';

  if (mode === 'generate_tests' || lastMsg.toLowerCase().includes('test')) {
    const res = context.currentResponse;
    if (!res || !res.status) {
      return {
        text: "Please send a request first so I can inspect the response payload and automatically write targeted test assertions for it!",
        suggestions: null
      };
    }

    const assertions = [
      {
        id: `gen-${Date.now()}-1`,
        name: `Status is ${res.status}`,
        type: 'STATUS_CODE_EQUALS',
        expected: String(res.status),
        enabled: true
      },
      {
        id: `gen-${Date.now()}-2`,
        name: `Response time < ${Math.max(500, Math.ceil(res.timeMs * 1.5))}ms`,
        type: 'RESPONSE_TIME_LESS_THAN',
        expected: String(Math.max(500, Math.ceil(res.timeMs * 1.5))),
        enabled: true
      }
    ];

    if (res.data && typeof res.data === 'object') {
      const keys = Array.isArray(res.data) 
        ? (res.data[0] ? Object.keys(res.data[0]).slice(0, 3) : [])
        : Object.keys(res.data).slice(0, 4);

      keys.forEach((key, idx) => {
        assertions.push({
          id: `gen-${Date.now()}-${idx + 3}`,
          name: `Property "${key}" exists`,
          type: 'JSON_PROPERTY_EXISTS',
          target: key,
          expected: '',
          enabled: true
        });
      });
    }

    return {
      text: `### 🧪 Generated Test Suite for Status ${res.status}\n\nI analyzed your response and created **${assertions.length} assertions** checking status code, latency bounds, and payload schema integrity.\n\nClick **"Apply Assertions"** below to load them directly into your request!`,
      suggestions: { assertions }
    };
  }

  if (mode === 'diagnose_error' || lastMsg.toLowerCase().includes('error') || (context.currentResponse && context.currentResponse.status >= 400)) {
    const status = context.currentResponse?.status || 400;
    const bodyStr = JSON.stringify(context.currentResponse?.data || {});

    let analysis = '';
    let suggestion = '';

    if (status === 401) {
      analysis = "### 🔒 401 Unauthorized Diagnosis\nThe target API rejected the request because valid authentication credentials were not provided or have expired.";
      suggestion = "**Recommended Fix**:\n1. Check the **Auth tab** and verify your Bearer Token or API Key.\n2. If using dynamic variable `{{token}}`, ensure it is defined in your active Environment.\n3. Make sure the header `Authorization: Bearer <token>` is not overridden in the Headers tab.";
    } else if (status === 403) {
      analysis = "### 🚫 403 Forbidden Diagnosis\nYour credentials were authenticated, but the user/token lacks necessary permissions (scopes or RBAC roles) to access this resource.";
      suggestion = "**Recommended Fix**:\n1. Check if the token requires additional scopes (e.g. `write:users`, `admin`).\n2. Verify the endpoint URL path and organization/tenant ID.";
    } else if (status === 404) {
      analysis = "### 🔍 404 Not Found Diagnosis\nThe requested endpoint or resource ID could not be located on the server.";
      suggestion = "**Recommended Fix**:\n1. Check for typos in the URL path.\n2. Ensure trailing slash matches API requirements.\n3. Verify that path parameters or IDs exist in the database.";
    } else if (status === 422 || status === 400) {
      analysis = `### ⚠️ ${status} Bad Request / Unprocessable Entity\nThe server received your request, but the payload format or parameters failed validation.\n\n**Server Message**: \`${bodyStr.slice(0, 150)}\``;
      suggestion = "**Recommended Fix**:\n1. Check the JSON syntax in your **Body** tab.\n2. Verify required fields against the API documentation.\n3. Ensure `Content-Type: application/json` is included in Headers.";
    } else if (status >= 500) {
      analysis = `### 💥 ${status} Server Error Diagnosis\nThe remote server encountered an unexpected condition or crash while processing your request.`;
      suggestion = "**Recommended Fix**:\n1. Check server-side logs if you own the API.\n2. Confirm all expected query parameters and body types match expectations.\n3. Retry with valid payload.";
    }

    return {
      text: `${analysis}\n\n${suggestion}\n\n*(Tip: You can also configure Local Ollama or Gemini in AI Settings for deep semantic reasoning)*`,
      suggestions: null
    };
  }

  // General Prompt-to-Request generator
  if (lastMsg.toLowerCase().includes('create') || lastMsg.toLowerCase().includes('get') || lastMsg.toLowerCase().includes('post') || lastMsg.toLowerCase().includes('endpoint')) {
    const isPost = /post|create|insert|add/i.test(lastMsg);
    const mockRequest = {
      name: isPost ? 'Generated POST Request' : 'Generated GET Request',
      method: isPost ? 'POST' : 'GET',
      url: 'https://jsonplaceholder.typicode.com/posts',
      headers: [
        { key: 'Content-Type', value: 'application/json', enabled: true },
        { key: 'Accept', value: 'application/json', enabled: true }
      ],
      bodyType: isPost ? 'json' : 'none',
      body: isPost ? JSON.stringify({ title: "New Item", description: "Created via Courier Copilot", status: "active" }, null, 2) : '',
      auth: { type: 'none' }
    };

    return {
      text: `### ✨ Generated API Request\n\nI constructed a **${mockRequest.method}** request configuration based on your description.\n\nClick **"Apply to Request"** below to load it into your editor!`,
      suggestions: { request: mockRequest }
    };
  }

  return {
    text: `👋 **Hi! I'm Courier Copilot**, your local-first API assistant.\n\nHere is how I can help you:\n- ⚡ **"Generate a POST request for user registration"**\n- 🧪 **"Generate test assertions for the current response"**\n- 🩺 **"Diagnose the error in my response"**\n- 🔄 **"Explain how to use dynamic variables like {{$guid}}"**\n\n*Enterprise Privacy*: You can connect me to your **Local Ollama** (` + '`http://localhost:11434`' + `) for 100% air-gapped, zero-data-leak intelligence, or supply a Gemini API Key!`,
    suggestions: null
  };
}

