# Courier 🚀
### Local-First, Git-Native API Workbench & Test Suite with "Chetan" (AI Companion)

> **Enterprise-Ready, 100% Air-Gapped & Telemetry-Free Postman/Bruno Alternative**

Postman and Bruno's mandatory cloud sync, account requirements, and deprecation of the offline scratchpad created severe security and compliance liabilities for developers, healthcare systems, defense contractors, and fintechs.

**Courier** is built from the ground up for developers who demand complete data privacy, lightning-fast execution, and seamless Git-native version control — combined with a next-generation AI companion named **Chetan** supporting **Local Ollama (`qwen2.5-coder:7b`)**, **Google AI (Gemini)**, and offline smart heuristics.

---

## 🌟 Key Features

### 1. ⚡ The Developer 80/20 Request Composer
- **HTTP Methods**: `GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `OPTIONS`, `HEAD`.
- **Query Params & Headers Editor**: Key-value tables with auto-complete and instant toggle checkboxes.
- **URI / Path Variables**: Auto-detects `:param` and `{param}` directly from URL paths.
- **Auth Presets**: Bearer Token, Basic Auth (`user:pass`), and API Key (Header or Query).
- **Body Formats**: JSON (with Beautify/formatting & syntax linting), `x-www-form-urlencoded`, Raw Text, or None.
- **Quick cURL Importer**: Paste any raw `curl` snippet (from Chrome DevTools or docs) to instantly populate the workbench.
- **1-Click Actions**: "Copy as cURL" and "Copy Response".

### 2. 📁 Git-Native Local Storage
- **Zero Cloud Lock-in**: All collections and environments are stored directly on your local filesystem in `./courier-data/collections/` and `./courier-data/environments/` as clean, readable JSON files.
- Commit, branch, PR, and review your API test suites alongside your application code in Git.

### 3. 🌐 Layered Environment Variable Scoping Engine
Courier features a hierarchical variable resolution engine that searches and resolves interpolation tags (`{{variableName}}`) in this exact order of precedence:

```
┌─────────────────────────────────────────────────────────────┐
│ 1. Folder / Local Request Context (Top Priority)            │
│    Path parameters & folder-scoped variable overrides       │
├─────────────────────────────────────────────────────────────┤
│ 2. Active Collection Environment                            │
│    Collection-level variables & presets                     │
├─────────────────────────────────────────────────────────────┤
│ 3. Global Workspace Environment (Baseline)                  │
│    Shared workspace environments (Dev, Staging, Prod)       │
└─────────────────────────────────────────────────────────────┘
```

- **Precise Inheritance & Overrides**: A folder variable overrides a collection variable with the same key, which in turn overrides a global workspace variable.
- **Built-in Dynamic Generators**:
  - `{{$guid}}` or `{{$uuid}}`: Generates random UUIDv4.
  - `{{$timestamp}}`: Unix epoch timestamp in seconds.
  - `{{$isoTimestamp}}`: ISO 8601 date string.
  - `{{$randomEmail}}`: Random user email for automated signup testing.
  - `{{$randomInt}}`: Random integer from 0 to 10,000.
- **Secret Masking**: Sensitive tokens and passwords stay protected with eye toggles.

### 4. 📜 User-Friendly Post-Response Scripting Engine
Courier includes a sandboxed, zero-friction scripting runtime inside the **Script** tab of every request. Migrating from Postman or Bruno is seamless with readable, modern assertion syntax:

#### Assertion Syntax
```javascript
// Clean, readable assertions
expect(response.status).toBe(200);
expect(response.timeMs).toBeLessThan(1000);
expect(response.data).toBeDefined();
expect(response.data.role).toEqual("admin");
expect(response.data.permissions).toContain("read:users");
```

#### Dynamic Variable Scope Selection
Developers can choose their variable scope dynamically after receiving an API response payload:
- **`setEnv("key", "value")`**: Saves or updates the variable locally within that specific **Collection / Folder scope** — preventing pollution of global variables.
- **`setGlobalEnv("key", "value")`**: Promotes and saves the variable to the **Global Workspace level**, immediately accessible by any other request in any collection.
- **`getEnv("key")`**: Reads variables across the tiered scope hierarchy (`Folder/Local -> Collection -> Global`).

#### Postman & Bruno Compatibility
```javascript
// Postman syntax works out-of-the-box:
pm.test("Status is 200", () => {
  pm.expect(pm.response.code).to.equal(200);
});
pm.environment.set("token", pm.response.json().token); // maps to setEnv
pm.globals.set("apiBase", "https://api.example.com");  // maps to setGlobalEnv
```

### 5. 🧪 Test Assertion Engine & In-Browser Suite Runner
- **Visual Assertions**: Configure presets without writing code (`Status Code Equals`, `Status is 2xx`, `Response Time < X ms`, `JSON Property Exists`, `JSON Property Equals`).
- **Live Assertion Badges**: Real-time pass/fail badges (`✓ 3/3 Passed`) with detailed error messages.
- **Script Logs Inspection**: The response panel displays a dedicated **Script Assertions & Logs** view showing passed assertions, failed checks, and `console.log()` statements.
- **Suite Runner Modal**: Execute an entire collection sequentially in the browser with live progress, latency metrics, and pass/fail reports with tiered variable inheritance.

### 6. 🤖 Chetan (AI Companion)
Courier includes an integrated, local-first AI assistant named **Chetan** that gives you an edge over Postman and Bruno:
- **Local Ollama (`qwen2.5-coder:7b`)**: Connects directly to local Ollama (`http://127.0.0.1:11434`) — **100% offline, air-gapped, and zero bytes leave your computer**. Includes built-in connection verification.
- **Google AI Mode (Gemini 2.5 Flash / 1.5 Pro)**: High-speed, high-accuracy semantic reasoning via Gemini BYOK.
- **OpenAI BYOK (`gpt-4o-mini`)**: Full OpenAI ChatGPT compatibility.
- **Offline Smart Engine**: Built-in intelligent rule heuristics that work immediately without any API key or external service!
- **Core Chetan Capabilities**:
  - ✨ **Prompt-to-Request**: Type *"Create a POST request for user signup with email and password"* to generate a complete request.
  - 🧪 **Auto-Generate Test Assertions**: Click *"Gen Tests"* on any response to have Chetan analyze the payload and write targeted assertions.
  - 🩺 **AI Error Diagnoser**: Click *"Diagnose Error"* on 4xx/5xx responses for root-cause analysis and 1-click remediation.
  - 📐 **Responsive Sidebar & Window Controls**: Minimize into an icon strip, expand to 50% width for deep code analysis, or toggle side-by-side vs stacked layouts.

### 7. 💻 Headless CLI Runner for CI/CD
Run your test suites in GitHub Actions, GitLab CI, Jenkins, or Docker without launching the GUI:
```bash
node server/cli.js run ./courier-data/collections/col-sample-1.json --env Development
```

---

## 🚀 Getting Started

### Prerequisites
- Node.js v18+ (Node.js v22 LTS is recommended).
- Optional: [Ollama](https://ollama.com/) with `qwen2.5-coder:7b` for local air-gapped AI (`ollama run qwen2.5-coder:7b`).

### Setup
```bash
git clone <your-repo-url>
cd Courier
npm install
```

### Running the Full-Stack Application
To start both the local API proxy (port 4174) and the Vite frontend (port 5173):
```bash
npm run dev
```
Open **`http://localhost:5173`** in your browser.

Or start the standalone server serving the production build:
```bash
npm start
```
Open **`http://localhost:4174`** in your browser.

### Running Automated Tests
```bash
npm test
```

### Packaging for Windows
```bash
npm run build
npm run dist
```
This creates a portable Windows executable in `release/`.

```bash
npm run build
npm run dist:zip
```
This creates a ZIP archive of the packaged Windows app in `release/`.

```bash
npm run build
npm run pack
```
This creates an NSIS installer `.exe` for standard enterprise installation flows.

---

## 🛡️ Enterprise Security & Privacy Guarantee
Courier is 100% telemetry-free. There are no tracking scripts, no third-party analytics, and no cloud logins. All network requests are executed directly from your local machine to your target APIs.
