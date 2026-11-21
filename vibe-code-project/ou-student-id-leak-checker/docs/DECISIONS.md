# Architectural & Design Decisions Log (`DECISIONS.md`)

This document records the conservative architectural, privacy, security, and design decisions made during Phase 1 (Research & Planning) for the **"Are your student ID and name exposed anywhere?"** self-check web tool in `Course-Projects-From-OU-Students/vibe-code-project/`.

---

## Decision 1: Directory Topology & Coexistence with `hcmc-ou-a-search/`
- **Context:** `vibe-code-project/` hosts multiple independent vibe-coded projects alongside its top-level `vibe-code-project/README.md` index.
- **Decision:** Isolate all files for the exposure self-check tool inside its own dedicated sub-folder `vibe-code-project/ou-student-id-leak-checker/` (`index.html`, `disclaimer.html`, `404.html`, `styles.css`, `app.js`, `app.test.js`, `package.json`, `README.md`, `docs/PLAN.md`, `docs/DECISIONS.md`) using strictly relative paths (`./styles.css`, `./app.js`, `./disclaimer.html`, `./index.html`). Do not touch or modify the sibling project `vibe-code-project/hcmc-ou-a-search/`.
- **Rationale:** Gives each project under `vibe-code-project/` a clean, self-contained directory hierarchy while allowing GitHub Pages to serve `/vibe-code-project/ou-student-id-leak-checker/` and `/vibe-code-project/hcmc-ou-a-search/` natively.

## Decision 2: Client-Side Public Exposure Discovery via Parallel Multi-Track Search & 3-Gateway Fallback Chain
- **Context:** A static GitHub Pages site cannot hold secret API keys (`CWE-798`) and cannot directly `fetch()` cross-origin HTML search engines (Yahoo, Scribd) because those servers do not emit `Access-Control-Allow-Origin: *`.
- **Decision:**
  1. Implement a keyless, client-side multi-track search and verification pipeline using 3 active public read-only CORS/reader gateways in priority order: `https://r.jina.ai` (primary), `https://api.codetabs.com` (fallback 1), and `https://api.allorigins.win` (fallback 2), with full gateway failover on all targets (including `scribd.com/search`).
  2. Run **Track 1 (Scribd Regional Mirrors)** and **Track 2 (General Web & Academic Repositories via Yahoo Search)** concurrently via `Promise.allSettled`:
     - **Track 1 (`buildScribdTrackUrls`, `10,000 ms` timeout):** Uses a non-overlapping stride of 2 across `SCRIBD_SEARCH_MIRRORS` (`vi`, `id`, `pt`, `es`, `fr`, `de`, `www.scribd.com`) so parallel queries never collide on the same upstream mirror, emitting preliminary verified findings via `onPartialFindings` for progressive UI rendering.
     - **Track 2 (`buildWebTrackUrls`, `15,000 ms` timeout):** Queries Yahoo Web Search concurrently on primary queries to discover exposures on `*.ou.edu.vn`, `studocu.com`, `slideshare.net`, `123docz.net`, `github.com`, and public PDFs/spreadsheets.
  3. Strip echoed search query strings and SERP headers (`stripQueryEchoes`), never auto-confirm `confirmedId` or `confirmedName` without text evidence, and perform a deep document verification pass (up to `MAX_DEEP_VERIFY_DOCS = 4` documents per search) when a result snippet shows only a partial match.
  4. Explicitly disclose in the UI and `disclaimer.html` that queries traverse the 3 public read-only CORS gateways over HTTPS, and recommend a **self-hosted serverless proxy** (e.g., Cloudflare Worker calling an official Search API with zero-log edge policies) as the long-term production alternative without silently introducing a custom backend server here.
- **Rationale:** Achieves genuine runtime discovery across both Scribd and general web/university portals with zero synthetic false positives, while maintaining full transparency about third-party proxy caveats.

## Decision 3: Strict Third-Party PII Redaction (No Raw Snippet Display)
- **Context:** Publicly leaked university rosters (e.g., on Scribd or public spreadsheets) typically contain rows of many students' names, student IDs, birthdates, and phone numbers in close proximity. Displaying a raw search snippet or document excerpt around a matched ID would expose other students' PII (`CWE-200`).
- **Decision:** The parser inspects fetched HTML/text in memory solely to compute boolean match flags (`hasId` and `hasName`) and extract the source title/domain and canonical `https:` URL. Raw document snippets are immediately discarded and **never** rendered in the DOM. Each finding renders only:
  1. Source name/type (hostname classification),
  2. Direct validated `https:` link (`rel="noopener noreferrer" target="_blank"`),
  3. Verdict (`GENUINE` or `FALSE POSITIVE`),
  4. Matched fields badge (`Student ID + Student Name`, `Student ID only`, or `Student Name only`),
  5. A deterministic one-line reason template.
- **Rationale:** Enforces strict privacy-by-design and eliminates the risk of re-exposing third-party personal data.

## Decision 4: Official OU Brand Blue (`#005BAC` & `#1956B3`) and Impeccable v4.10.0 Craft Floor
- **Context:** The tool serves Ho Chi Minh City Open University (OU) students and must follow the `pbakaus/impeccable` design rules while using official OU blue and meeting WCAG AA contrast.
- **Decision:**
  - Use **`#005BAC`** (verified from repository root `README.md` official OU badge) as `--ou-blue-primary` (contrast `6.84:1` on `#FFFFFF`, passing WCAG AA/AAA), paired with **`#1956B3`** (verified from official `ou.edu.vn/wp-content/themes/education/style_phe.css` and `css/style_l.css`, contrast `6.81:1` on `#FFFFFF`) and deep hover/ink **`#003E78`** (`10.45:1` on `#FFFFFF`).
  - Enforce all Impeccable v4.10.0 `Operate`/`Read` mode and `craft-floor.md` bans: no eyebrows/kickers above headings, no nested cards, no `border-left` side-tabs on alerts/cards, no purple gradients or neon glows, no emoji icons, `16px` (`1rem`) minimum body text, `60ch–72ch` reading measure, and `>= 44×44px` touch targets.
- **Rationale:** Combines authentic HCMOU visual identity with deterministic accessibility and anti-slop craftsmanship.

## Decision 5: Zero Runtime Dependencies & Tightened Meta CSP + Frame-Busting Defense
- **Context:** Static GitHub Pages sites cannot emit custom HTTP headers (`Content-Security-Policy` header or `X-Frame-Options`), and `<meta http-equiv="Content-Security-Policy">` ignores `frame-ancestors` per W3C specification.
- **Decision:**
  - Ship zero third-party JS/CSS/font dependencies (`CWE-829` / `CWE-1104`).
  - Apply strict `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'self'; style-src 'self'; connect-src https://api.allorigins.win https://api.codetabs.com https://r.jina.ai; img-src 'self' data:; font-src 'self'; base-uri 'none'; form-action 'none'; object-src 'none';">` restricting `connect-src` exclusively to the 3 active gateways (`r.jina.ai`, `api.codetabs.com`, `api.allorigins.win`).
  - Ban all dangerous DOM sinks (`innerHTML`, `outerHTML`, `insertAdjacentHTML`, `document.write`, `eval`) in favor of `document.createElement` + `textContent`.
  - Implement JavaScript top-frame verification (`window.top !== window.self`) on load to disable the UI if embedded in an unauthorized iframe (`CWE-1021`), and document the static-host header limitation in `PLAN.md`.
- **Rationale:** Maximizes client-side defense-in-depth across the entire CWE checklist on a static GitHub Pages origin.

## Decision 6: Zero Prohibited Live-Test Data in Repository
- **Context:** Phase 3 automated verification enforces a strict rule that the live-test sample student ID, sample student name, and specific Scribd document URL must never appear in any committed file, test fixture, comment, or plan.
- **Decision:** All unit tests in `app.test.js` and examples in `PLAN.md` / `DECISIONS.md` use synthetic placeholder patterns (e.g., `0000000000` or `1234567890` and generic placeholder names like `Nguyen Van A`), while the runtime discovery and normalization engine handles any valid 10-digit ID and Vietnamese name dynamically.
- **Rationale:** Guarantees 100% compliance with the prohibited test-data gate and prevents committing real student PII to the public repository.

## Decision 7: Dedicated EN / VI Language Switcher, Authentic Impeccable v4.10.0 "Paper & Instruments" UI, and Fast Regional-Subdomain Rotation
- **Context:** Mixing Vietnamese and English simultaneously inside every heading and paragraph felt cluttered and "AI-generated", and the public `disclaimer.html` previously included an internal owner note ("Recommendation for Qualified Legal Review") that should not be displayed on the public page. Furthermore, `r.jina.ai` throttles repeated anonymous requests to `www.scribd.com` (`403 AbuseAlleviationError`), while Yahoo Search via `r.jina.ai` took ~15 seconds and timed out at 6,000 ms, causing the live GitHub Pages deployment to return 0 results when `www.scribd.com` was throttled.
- **Decision:**
  1. **Consistent Language Switching (EN / VI):** Implement a clean segmented language switcher (`EN` / `VI`) in the institutional utility header across `index.html`, `disclaimer.html`, and `404.html` so only one consistent language is visible at a time (defaulting to English, switchable to 100% Vietnamese with zero mixed-language clutter, while keeping zero `localStorage`/`cookies`).
  2. **Remove Internal Owner Legal Note from Public UI:** Remove Clause 9 ("Explicit Note to Repository Owner: Recommendation for Qualified Legal Review") from `disclaimer.html` so `disclaimer.html` contains only public-facing protection clauses (Clauses 1–8).
  3. **Impeccable v4.10.0 "Paper and Instruments" Redesign:** Replace the stacked "boxed cards everywhere" layout with a flat editorial paper canvas (`#F7F9FC` / `#FFFFFF`), an authoritative Official OU Blue (`#005BAC`) institutional masthead, raised tactile input/button instruments, horizontal `1px` hairline ledger rows for findings and methodology, and strict `"Mono Means Machine"` typography (`ui-monospace` with `tabular-nums` for 10-digit IDs, verdict tags, and URLs).
  4. **Fast Regional Scribd Subdomain Rotation (~3.5s Search):** Rotate Scribd full-text search queries across regional Scribd hosts (`vi.scribd.com`, `id.scribd.com`, `pt.scribd.com`, `es.scribd.com`, `fr.scribd.com`, `de.scribd.com`, `www.scribd.com`) with a 10,000 ms timeout and automatic failover on HTTP 403/`AbuseAlleviationError`, completing combined ID+Name and ID-only checks in ~3.5–4.5 seconds without waiting 16 seconds on Yahoo Search unless fallback is needed.
- **Rationale:** Delivers a fast (~4s), reliable live search on GitHub Pages, a genuinely crafted Impeccable v4.10.0 academic instrument UI, and 100% language consistency.

