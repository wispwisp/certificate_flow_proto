# CLAUDE.md

Certificate generator for a training center. Staff upload a DOCX letterhead template, the app discovers the fields,
lets them fill the values by hand or from a CSV file, shows a preview, and exports PDF: one document, or a ZIP for a whole group.

## Claude directives about code
I don't want to go deep into code. Code architecture, code design, and microarchitecture are completely up to you. Just do your best and keep code simple and readable. When I ask for a high-level feature, you should ask only clarifying questions about those featues, not code design decisions.

## Browser verification
- No display in this container; the `playwright` MCP is headless. Never use
  `--headed`, `--ui`, `--debug`, `show-report`, `codegen`, `page.pause()`.
- Dev server: `npm run dev` → http://localhost:5173; if not up, start it as a
  background Bash task and poll until 200.
- After any UI change: `browser_navigate` → `browser_snapshot` → exercise the
  change → `browser_console_messages` level `error` must be empty →
  screenshot into `.playwright-mcp/` only for visual changes, inspect with
  Read → `browser_close`. Report what was verified; never "done" on typecheck alone.
- Prefer snapshot/`browser_find` over screenshots; use `depth` on large pages.

## Git authorship
- email forworkandtravel@yandex.ru, name "wisp"

## Files to ignore
Ignore those files completely, as they are not your concern.
- build_claudecode_isolation_container.sh
- run_claudecode_isolation_container.sh
- claudecode.dockerfile
- check_grammar.sh

---

# Engineering Principles

## 1. Think Before Coding
- **Stop and ask** if requirements are ambiguous. Do not guess.
- **State assumptions explicitly** before writing any non-trivial code.
- **Present multiple interpretations** with tradeoffs if more than one valid approach exists.
- **Push back** if a requested change is over-engineered or adds unnecessary complexity.

## 2. Simplicity First
- Write the **minimum code** required to solve the task.
- Avoid speculative features, abstractions for single-use code, or "future-proofing."
- If a 200-line solution can be 50 lines, rewrite it.
- **Seniority Test**: If a senior engineer would call it "bloated," simplify it.

## 3. Surgical Changes
- **Touch only what is required.** Match existing code style perfectly.
- Do not "improve" adjacent code, refactor unrelated sections, or change formatting/quotes.
- **Preserve comments** you don't fully understand; do not delete them.
- Every line changed must trace directly to the current request.

## 4. Goal-Driven Execution
- Transform tasks into **verifiable goals** (e.g., "Write a failing test for [bug], then make it pass").
- Provide a brief plan for multi-step tasks before starting.
- **Loop until verified**: Do not declare success until you have run the relevant tests or verification steps.

