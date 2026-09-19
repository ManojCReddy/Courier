# Courier 🚀
### Local-First, Git-Native API Workbench & Test Suite with "Courier Copilot" (AI Edge)

> **Enterprise-Ready, 100% Air-Gapped & Telemetry-Free Postman/Bruno Alternative**

Postman's mandatory cloud sync, account requirements, and deprecation of the offline scratchpad created severe security and compliance liabilities for developers, healthcare systems, defense contractors, and fintechs.

**Courier** is built from the ground up for developers who demand complete data privacy, lightning-fast execution, and seamless Git-native version control — combined with a next-generation **AI Copilot** supporting **Google AI (Gemini)** and **Local Ollama** (100% offline).

---

## 🌟 Key Features

### 1. ⚡ The Developer 80/20 Request Composer
- **HTTP Methods**: `GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `OPTIONS`, `HEAD`.
- **Query Params & Headers Editor**: Key-value tables with auto-complete and instant toggle checkboxes.
- **Auth Presets**: Bearer Token, Basic Auth (`user:pass`), and API Key (Header or Query).
- **Body Formats**: JSON (with Beautify/formatting & syntax linting), `x-www-form-urlencoded`, Raw Text, or None.
- **Quick cURL Importer**: Paste any raw `curl` snippet (from Chrome DevTools or docs) to instantly populate the workbench.
- **1-Click Actions**: "Copy as cURL" and "Copy Response".

### 2. 📁 Git-Native Local Storage
- **Zero Cloud Lock-in**: All collections and environments are stored directly on your local filesystem in `./courier-data/collections/` and `./courier-data/environments/` as clean, readable JSON files.
- Commit, branch, PR, and review your API test suites alongside your application code in Git.

### 3. 🌐 Dynamic Environments & Variables
- Multi-environment switching (`Development`, `Staging`, `Production`, `No Environment`).
- Variable interpolation across URL, Headers, Body, and Query Params using `{{variableName}}`.
- **Built-in Dynamic Generators**:
  - `{{$guid}}` or `{{$uuid}}`: Generates random UUIDv4.
  - `{{$timestamp}}`: Unix epoch timestamp in seconds.
  - `{{$isoTimestamp}}`: ISO 8601 date string.
  - `{{$randomEmail}}`: Random user email for automated signup testing.
  - `{{$randomInt}}`: Random integer.
- Secret masking for sensitive tokens and passwords.

### 4. 🧪 Test Assertion Engine & In-Browser Suite Runner
- Build assertions directly in the workbench:
  - `Status Code Equals` (e.g. 200, 201)
  - `Status is 2xx Success`
  - `Response Time < X ms`
  - `JSON Property Exists` (e.g. `data.user.id`)
  - `JSON Property Equals` (e.g. `status` == `active`)
- Real-time test results badge (`✓ 3/3 Passed`) with detailed error messages if any assertion fails.
- **Suite Runner Modal**: Execute an entire collection sequentially in the browser with live progress, latency graphs, and pass/fail reports.

### 5. 🤖 Courier Copilot (AI Edge)
Courier includes an integrated AI assistant that gives you an edge over Postman and Bruno:
- **Google AI Mode (Gemini 2.5 Flash / 1.5 Pro)**: High-speed, high-accuracy semantic reasoning via Gemini BYOK.
- **Local Ollama (100% Offline & Air-Gapped)**: Connects to your local Ollama instance (`http://localhost:11434`) — **zero bytes leave your computer**.
- **Offline Smart Engine**: Built-in intelligent rule heuristics that work immediately without any API key or external service!
- **Core AI Capabilities**:
  - ✨ **Prompt-to-Request**: Type *"Create a POST request for user signup with email and password"* to generate a complete request.
  - 🧪 **Auto-Generate Test Assertions**: Click *"Gen Tests"* on any response to have Copilot analyze the payload and write targeted assertions.
  - 🩺 **AI Error Diagnoser**: Click *"Diagnose Error"* on 4xx/5xx responses for root-cause analysis and 1-click remediation.

### 6. 💻 Headless CLI Runner for CI/CD
Run your test suites in GitHub Actions, GitLab CI, Jenkins, or Docker without launching the GUI:
```bash
node server/cli.js run ./courier-data/collections/col-sample-1.json --env Development
```

---

## 🚀 Getting Started

### Prerequisites
- Node.js v18+ (Node.js v22 LTS portable is configured in your user space).

### Setup
```bash
git clone <your-repo-url>
cd Courier
npm install
```

If you are on a Windows machine and want to build a desktop package, it is helpful to run PowerShell or a terminal as an administrator so signing-related steps can complete without policy or symlink issues.

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
This creates a portable Windows executable in [release](release).

```bash
npm run build
npm run dist:zip
```
This creates a ZIP archive of the packaged Windows app in [release](release).

```bash
npm run build
npm run pack
```
This creates an NSIS installer `.exe` for standard installation flows.

> Generated packaging files such as the EXE and ZIP are stored in [release](release) and are intentionally not tracked by Git because the project ignores that folder via [.gitignore](.gitignore). This is normal for build artifacts.

### Running CI/CD Suite Runner
```bash
node server/cli.js run ./courier-data/collections/col-sample-1.json --env Development
```

---

## � Building a Windows Desktop App for End Users
Courier is prepared for desktop packaging so your users do not need Node.js or npm installed.

### Portable Windows app
```bash
npm install
npm run build
npm run dist
```

This creates a portable Windows executable in the `release/` folder.

### Installer version
```bash
npm install
npm run build
npm run pack
```

This creates an NSIS installer `.exe` for standard enterprise distribution.

> Users only run the generated desktop app. They do not need to install Node, run `npm install`, or use a terminal.

---

## �🛡️ Enterprise Security & Privacy Guarantee
Courier is 100% telemetry-free. There are no tracking scripts, no third-party analytics, and no cloud logins. All network requests are executed directly from your local machine to your target APIs.
