# Quantum Snakes & Ladders: Mixed-Initiative Grover’s Search Workbench

**README Prose Word Count:** 526 words (excluding headings, code blocks, and file tree)

## Project Status
- **Implemented:** 
  - Deterministic 6-qubit ($N = 64$) Grover state-vector engine (`app.js`) supporting uniform Hadamard superposition, Phase Oracle sign inversion ($\psi_w \rightarrow -\psi_w$), Diffusion (inversion about the mean), and renormalisation following an illustrative coupling-and-damping noise model ($\sum \vert{}\psi_x\vert{}^2 = 1$).
  - Perceptual Viridis ($p^{0.35}$) $8 \times 8$ probability grid (`styles.css`) and noise-conditional SVG overlays rendering coupling ladders and damping snakes.
  - Client-side structured-response and bounds validator (`validateInference()`) enforcing exact field structure, board index bounds (`1..64`), and concise rationales ($\le 30$ words) before rendering.
  - Mixed-initiative foveal visual proposals (dashed cyan SVG ghost ring + proposal banner) paired with explicit supervisory controls (`Apply Proposed Step` and `Dismiss / Undo`). Proposals require explicit learner approval; dismissal discards pending actions without changing simulation state.
  - Conceptual overview routing (`grover_overview` with guided-tour chips), out-of-scope boundary declines with recovery chips, `"You asked:"` query receipt pills, proactive over-rotation coaching at `iterations >= 6`, and a collapsible JSON contract inspector.
- **Simulated:** 
  - Natural-language intent classification is simulated locally through a deterministic, rule-based router (`routeInference()`). The router uses implemented live simulation telemetry to generate context-specific explanations and proposed actions, enabling reproducible offline interaction without external APIs.
- **Planned/ Not Implemented:** 
  - Cloud-based LLM integration, multi-turn conversational memory, multi-target search and comparative learner evaluation.

## Technology Stack
- **Frontend & Simulation:** Vanilla HTML5, CSS3, and ES6 JavaScript (`index.html`, `styles.css`, `app.js`) with inline SVG overlays—zero external runtime dependencies or build steps; optional Google Fonts require internet access.
- **Development & Testing Tools:** Visual Studio Code, Git/GitHub, Playwright / Node.js automated verification (temporary not included in final repository), and GitHub Copilot (Agent/Edit mode) for iterative refactoring and test generation.

## Running and Inspecting the Work
1. Clone or download this repository.
2. Double-click `index.html` to open it directly in any modern browser (`file://` compatible—no local web server, package install, or API key required).

## Development Record
- **Stage 1 - Baseline Quantum Simulation (`feat:`):** Built the 64-square Grover state-vector engine, K6 hardware topology visualiser, and conceptual introduction tab.
- **Stage 2 - Mixed-Initiative AI Copilot & Guardrails (`feat:`):** Added structured JSON proposal routing, pre-flight structural/bounds validation (`1..64`), $p^{0.35}$ Viridis colour scaling, SVG ghost-ring overlays, and supervisory `[Apply Proposed Step]` / `[Dismiss / Undo]` buttons.
- **Stage 3 - Three-File Architecture Refactor (`refactor:`):** Separated monolithic HTML into `index.html`, `styles.css`, and `app.js` using standard `defer` script loading (no ES module imports) to guarantee offline `file://` compatibility.
- **Stage 4 - State-Grounded Intelligence & Cleanup (`feat:` / `chore:`):** Added `grover_overview` routing for broad conceptual questions, live state-vector telemetry injection, a 30-word rationale guardrail, `"You asked:"` query receipts, proactive over-rotation coaching at `iterations >= 6`, an inspectable JSON contract drawer, and removed unused API key stubs.

## AI Assistance
- **Tools Used:** GitHub Copilot (VS Code Agent/Edit mode) and Gemini for HCI design critique and documentation structure.
- **How Suggestions Were Checked and Modified:** GitHub Copilot assisted in splitting `index.html` into three static files and generating automated verification checks (`test_suite.js`, removed after passing). During testing, I identified that early AI-generated routing defaulted broad conceptual queries (e.g., *"What is Grover's algorithm?"*) to the Oracle step and used static text; I redesigned `routeInference()` to classify `grover_overview` turns without mutating tiles, inject live state-vector percentages, and enforce `<= 30`-word bounds in `validateInference()`. I also removed unused API key scaffolding, fixed a CSS universal selector typo (`styles.css`), and verified state normalisation and offline `file://` execution manually in the browser.

## Repository Structure & Additional Files
```text
├── index.html                   # Main offline-compatible application structure
├── styles.css                   # Perceptual Viridis grid and responsive layout styles
├── app.js                       # 6-qubit Grover simulation engine and schema-validated Copilot
├── README.md                    # Project overview, setup instructions, and development record
└── docs/
    ├── system_architecture.png  # Color-coded system diagram (Implemented vs. Simulated)
    └── storyboards.png          # Illustrated interaction flow storyboards