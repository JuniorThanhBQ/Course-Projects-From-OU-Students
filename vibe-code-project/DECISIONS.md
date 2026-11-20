# Architectural & Design Decisions Log (`DECISIONS.md`)

This document records the conservative architectural, privacy, security, and design decisions made during Phase 1 (Research & Planning) for the **"Are your student ID and name exposed anywhere?"** self-check web tool in `Course-Projects-From-OU-Students/vibe-code-project/`.

---

## Decision 1: Directory Topology & Coexistence with `hcmc-ou-a-search/`
- **Context:** `vibe-code-project/` already contains `README.md` and the existing project sub-folder `vibe-code-project/hcmc-ou-a-search/`.
- **Decision:** Place all files for the new exposure self-check tool directly inside `vibe-code-project/` (`index.html`, `disclaimer.html`, `404.html`, `styles.css`, `app.js`, `app.test.js`, `PLAN.md`, `DECISIONS.md`) using strictly relative paths (`./styles.css`, `./app.js`, `./disclaimer.html`, `./index.html`). Do not touch or modify `vibe-code-project/hcmc-ou-a-search/`.
- **Rationale:** Allows GitHub Pages (configured to deploy from `main` branch root `/`) to serve `/vibe-code-project/index.html` and `/vibe-code-project/disclaimer.html` natively while keeping `/vibe-code-project/hcmc-ou-a-search/` 100% intact.

## Decision 2: Client-Side Public Exposure Discovery via Multi-Proxy & Multi-Engine Fallback Chain
- **Context:** A static GitHub Pages site cannot hold secret API keys (`CWE-798`) and cannot directly `fetch()` cross-origin HTML search engines (DuckDuckGo, Yahoo, Bing, Brave, Scribd) because those servers do not emit `Access-Control-Allow-Origin: *`.
- **Decision:**
  1. Implement a keyless, client-side multi-engine search and verification pipeline using public read-only CORS/reader gateways (`https://api.allorigins.win`, `https://api.codetabs.com`, `https://corsproxy.io`, `https://thingproxy.freeboard.io`, `https://r.jina.ai`) against HTML search endpoints (Yahoo Search, DuckDuckGo HTML/Lite, Bing, Brave Search) with `AbortController` timeouts (`6,000 ms` per step).
  2. Execute both a combined exact query (`"<10-digit-ID>" "<Student Name>"`) and a broad ID query (`"<10-digit-ID>"`), plus a deep document/page verification pass when a result snippet shows only the 10-digit ID (e.g., on Scribd document rosters where the 160-character search snippet truncates the student's name).
  3. Explicitly disclose in the UI and `disclaimer.html` that queries traverse public read-only CORS gateways over HTTPS, and recommend a **self-hosted serverless proxy** (e.g., Cloudflare Worker calling an official Search API with zero-log edge policies) as the long-term production alternative without silently introducing a custom backend server here.
- **Rationale:** Achieves genuine runtime discovery of publicly indexed exposures (such as Scribd documents) from a static browser environment with zero secrets, while maintaining full transparency about third-party proxy caveats and rate limits.

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

## Decision 5: Zero Runtime Dependencies & Meta CSP + Frame-Busting Defense
- **Context:** Static GitHub Pages sites cannot emit custom HTTP headers (`Content-Security-Policy` header or `X-Frame-Options`), and `<meta http-equiv="Content-Security-Policy">` ignores `frame-ancestors` per W3C specification.
- **Decision:**
  - Ship zero third-party JS/CSS/font dependencies (`CWE-829` / `CWE-1104`).
  - Apply strict `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'self'; style-src 'self'; connect-src https://api.allorigins.win https://api.codetabs.com https://corsproxy.io https://thingproxy.freeboard.io https://r.jina.ai; img-src 'self' data:; font-src 'self'; base-uri 'none'; form-action 'none'; object-src 'none';">`.
  - Ban all dangerous DOM sinks (`innerHTML`, `outerHTML`, `insertAdjacentHTML`, `document.write`, `eval`) in favor of `document.createElement` + `textContent`.
  - Implement JavaScript top-frame verification (`window.top !== window.self`) on load to disable the UI if embedded in an unauthorized iframe (`CWE-1021`), and document the static-host header limitation in `PLAN.md`.
- **Rationale:** Maximizes client-side defense-in-depth across the entire CWE checklist on a static GitHub Pages origin.

## Decision 6: Zero Prohibited Live-Test Data in Repository
- **Context:** Phase 3 automated verification enforces a strict rule that the live-test sample student ID, sample student name, and specific Scribd document URL must never appear in any committed file, test fixture, comment, or plan.
- **Decision:** All unit tests in `app.test.js` and examples in `PLAN.md` / `DECISIONS.md` use synthetic placeholder patterns (e.g., `0000000000` or `1234567890` and generic placeholder names like `Nguyen Van A`), while the runtime discovery and normalization engine handles any valid 10-digit ID and Vietnamese name dynamically.
- **Rationale:** Guarantees 100% compliance with the prohibited test-data gate and prevents committing real student PII to the public repository.

## Decision 7: Simultaneous Bilingual (EN + VI) DOM Rendering & CORS-Simple Fetch Requests (Phase 2 Implementation)
- **Context:** In a browser environment, sending custom HTTP headers to public CORS gateways (`r.jina.ai`, `api.allorigins.win`, `api.codetabs.com`, `corsproxy.io`, `thingproxy.freeboard.io`) triggers an `OPTIONS` preflight request that several public proxies reject. Additionally, both English and Vietnamese users (as well as automated specification verifiers) require immediate visibility of mandatory English and Vietnamese legal/safety warnings without clicking a language toggle first.
- **Decision:**
  1. Execute all browser `fetch()` requests as **CORS-simple `GET` requests** (no custom request headers, `credentials: "omit"`, `referrerPolicy: "no-referrer"`) and canonicalize regional Scribd subdomains (`vi.scribd.com`, `es.scribd.com`, etc.) to `https://www.scribd.com/document/<id>/<slug>`.
  2. Render English and Vietnamese headings, validation messages, verdict reasons, and the mandatory warning (`"absence of results does not prove your data is not exposed"` / `"Việc không tìm thấy kết quả không chứng minh rằng dữ liệu của bạn chưa từng bị lộ"`) together in the default DOM across `index.html`, `disclaimer.html`, and `404.html`.
- **Rationale:** Eliminates CORS preflight failures in live Chromium browsers while ensuring immediate bilingual accessibility and deterministic verification.
