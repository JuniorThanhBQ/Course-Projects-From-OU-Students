# Implementation Plan — OU Student ID & Name Exposure Self-Check Tool

**Project Location:** `vibe-code-project/` (sibling to `vibe-code-project/hcmc-ou-a-search/`, which MUST NOT be modified)  
**Target Deployment:** GitHub Pages (static site built from `main` branch root `/`)  
**Tool Title (EN / VI):** "Are your student ID and name exposed anywhere?" / "Mã số sinh viên và họ tên của bạn có bị lộ ở đâu không?"

---

## Section a) Feasibility of the Exposure Search on a Static GitHub Pages Site

### 1. Why Direct Browser Fetches Are Blocked & How Client-Side Discovery Works
A static site hosted on GitHub Pages (`https://<username>.github.io/...`) executes entirely inside the visitor's browser with zero backend server and zero secret storage.
- **CORS Limitation:** Major public search engines (DuckDuckGo HTML/Lite, Yahoo Search, Bing, Brave Search, Google) and document-hosting platforms (Scribd, Studocu, SlideShare, PDF repositories) do not send `Access-Control-Allow-Origin: *` headers on their HTML search endpoints. Consequently, a direct `fetch("https://html.duckduckgo.com/html/?q=...")` from browser JavaScript is blocked by the browser's Same-Origin Policy (CORS).
- **Zero-Secret Client-Side Architecture (Multi-Engine + Multi-Proxy Fallback Matrix):**
  To operate dynamically at runtime in a real browser without API keys or a custom backend server, the client-side search engine in `app.js` uses a **two-query strategy** executed across a **resilient CORS-friendly endpoint & proxy fallback chain**:
  1. **Query Strategy (Dual-Query & Deep-Page Verification):**
     - **Query A (Combined Exact ID + Name):** `"<10-digit-ID>" "<Student Name>"` — immediately surfaces documents indexed with both the exact 10-digit student ID and the student's name in the search engine snippet.
     - **Query B (Exact ID Broad Discovery):** `"<10-digit-ID>"` — discovers public web pages and document hosts (such as `scribd.com/document/...`, `scribd.com/doc/...`, university portals, public spreadsheets/PDFs) where the 10-digit ID is indexed, even if the search engine's 160-character snippet truncates the student's name.
     - **Deep Document/Snippet Verification Step:** When a search result from Query B matches the exact 10-digit ID in its title/snippet/URL but the snippet alone does not yet show the student's normalized name, `app.js` performs a secondary read-only fetch of either:
       - A targeted verification query (`"<10-digit-ID>" "<Normalized/Raw Name>" site:<discovered-domain>`), OR
       - The discovered target document URL via CORS proxy / text-extractor (`r.jina.ai` / `api.allorigins.win` / `api.codetabs.com`) to inspect the public document body/metadata for the normalized student name.
       This guarantees that if a public document (e.g., an indexed roster on Scribd or a public webpage) contains both the 10-digit ID and the student's name anywhere in its public text or search index, it is accurately verified as `GENUINE`.
  2. **Search Engines & Public CORS Endpoints (Fallback Chain):**
     The client iterates through a prioritized list of search providers and read-only CORS gateways with per-request `AbortController` timeouts (6,000 ms per attempt) so that if one gateway rate-limits (HTTP 429) or times out, the next provider seamlessly fulfills the request:
     - **Search Targets (HTML/Text SERPs):**
       1. **Scribd Full-Text Search** (`https://www.scribd.com/search?query=<encoded_query>`) — directly queries Scribd's document full-text search index via Jina Reader, discovering public rosters where both the 10-digit ID and student name appear.
       2. **Yahoo Search HTML** (`https://search.yahoo.com/search?p=<encoded_query>&n=10`) — reliable via public proxies, lenient bot filtering compared to Google, and indexes Scribd (`scribd.com/document/...`) and Vietnamese `.edu.vn` pages with rich text snippets (`.compTitle`, `.compText`, `a[href]`).
       3. **DuckDuckGo HTML / Lite** (`https://html.duckduckgo.com/html/?q=<encoded_query>` and `https://lite.duckduckgo.com/lite/?q=<encoded_query>`) — clean static HTML structure (`.result__a`, `.result__snippet`, `uddg=` redirect parameter decoding).
       4. **Bing Web Search HTML** (`https://www.bing.com/search?q=<encoded_query>`) — parses `.b_algo h2 a` and `.b_caption p`.
     - **CORS Proxy & Reader Gateways (No API Key Required):**
       1. **Jina Reader API (Keyless Free Tier)** (`https://r.jina.ai/<target_url>`) — converts public web pages and search URLs into clean Markdown/text with CORS enabled (`Access-Control-Allow-Origin: *`), useful both as a SERP reader and for deep-verifying public document pages.
       2. **CodeTabs CORS Proxy** (`https://api.codetabs.com/v1/proxy?quest=<encoded_target_url>`) — direct raw HTML response with `Access-Control-Allow-Origin: *`.
       3. **AllOrigins JSON/Raw** (`https://api.allorigins.win/get?url=<encoded_target_url>`) — returns `{ contents, status }` fallback.
  3. **Safe Client-Side Parsing (Zero `innerHTML`):**
     - All HTML responses from proxies are parsed strictly using `new DOMParser().parseFromString(rawHtml, "text/html")` into an inert, non-executing `Document` object (or regex/text extraction on inert strings for Markdown/Lite formats).
     - Search engine redirect wrappers (such as DuckDuckGo's `//duckduckgo.com/l/?uddg=<encoded_url>` or Yahoo's `RU=<encoded_url>/RK=...`) are unwrapped and validated via `new URL(candidateUrl)` to extract the canonical destination `https:` URL.
     - Results are deduplicated by canonicalized URL (stripping tracking query parameters like `utm_*`, `srsltid`, and normalizing mobile/regional subdomains like `vi.scribd.com` / `www.scribd.com` while preserving the exact HTTPS link).

### 2. Rate Limits, API Keys, Terms of Service (ToS), and Privacy Caveats
| Aspect | Assessment & Operational Constraint |
|---|---|
| **API Keys / Secrets** | **None (Zero secrets).** No Google Custom Search keys, no SerpApi keys, no Bing API keys, and no proxy tokens are used or committed. |
| **Rate Limits** | Public CORS proxies (`allorigins.win`, `codetabs.com`, `corsproxy.io`) and `r.jina.ai` enforce per-IP rate limits (typically 5–60 requests/minute per visitor IP). Because the tool runs in the visitor's own browser, requests are distributed across each student's individual IP rather than concentrated on a single server IP. A client-side cooldown (2.5 seconds between searches) and `AbortController` cancellation prevent accidental request flooding. |
| **Privacy Caveat of Public Proxies** | When a browser queries a public CORS proxy (`r.jina.ai`, `api.codetabs.com`, `api.allorigins.win`), the search query (`student ID` and `student name`) traverses that third-party proxy over HTTPS. The UI and `disclaimer.html` MUST explicitly disclose this before the user submits a search. |
| **Source Terms of Service (ToS) Risks** | Automated scraping of search engine result pages (SERPs) and document portals via third-party proxies may conflict with search engine ToS or trigger anti-bot CAPTCHAs under heavy traffic. When all automated public proxies fail or are rate-limited, the UI must degrade gracefully with a clear status alert (never fabricated results) and provide safe, user-initiated direct verification links (`rel="noopener noreferrer"`) so the user is never stranded. |
| **Recommended Production Alternative** | For long-term institutional deployment, the final report and `DECISIONS.md` recommend replacing third-party public CORS proxies with a **self-hosted serverless edge proxy** (e.g., a Cloudflare Worker on a custom domain calling an official paid Search API such as Brave Search API or Google Programmable Search Engine with server-held secrets and zero-log policies). Per project constraints, we do **not** add a custom backend server here; everything ships as a pure static GitHub Pages package. |

### 3. Explicit Normalization & Verdict Rules

#### A. Input Validation & Normalization Specification
1. **Student ID (`studentId`):**
   - **Validation Rule:** Must match `/^\d{10}$/` after trimming leading/trailing ASCII whitespace. Any non-digit character, fewer than 10 digits, or more than 10 digits is rejected client-side before any network call.
2. **Student Name (`studentName`):**
   - **Validation Rule:** After trimming and collapsing consecutive whitespace to a single space, length must be between `2` and `80` characters inclusive, must contain at least one Unicode letter (`/\p{L}/u`), and must match `/^[\p{L}\s'.\-]+$/u` (linear-time character class; rejects digits, HTML brackets `< >`, quotes, and script syntax).
   - **Normalization Function (`normalizeText(str)`):**
     ```js
     function normalizeText(input) {
       return String(input)
         .normalize("NFC")
         .normalize("NFD")
         .replace(/[\u0300-\u036f]/g, "") // strip all combining diacritical marks
         .replace(/[đĐ]/g, "d")
         .toLowerCase()
         .replace(/[^a-z0-9\s]/g, " ")    // turn punctuation/hyphens into space boundaries
         .replace(/\s+/g, " ")
         .trim();
     }
     ```
   - **Matching Semantics:**
     - **ID Match (`hasId`):** The candidate document text (title + snippet + URL slug + optional fetched page body) contains the exact 10-digit `studentId` bounded by non-digit boundaries (`new RegExp(`(^|\\D)${studentId}(\\D|$)`).test(rawText)`), preventing partial matches inside 11+ digit phone numbers or timestamps.
     - **Name Match (`hasName`):** `normalizeText(candidateText)` contains the normalized full `studentName` as a contiguous token sequence (word-boundary matched: `new RegExp(`(^|\\s)${escapeRegExp(normalizedName)}(\\s|$)`).test(normalizedCandidateText)`), OR when a document slug/OCR splits tokens, every token of `normalizedName` (for multi-word names >= 2 tokens) appears in close proximity (within a 60-character window) in `normalizedCandidateText`.

#### B. Explicit Verdict Rule (`GENUINE` vs. `FALSE POSITIVE`)
Every discovered web result is evaluated against `hasId` and `hasName` (including after deep verification of the result page or combined ID+Name query confirmation) and assigned one of two verdicts:

| Verdict | Condition | Matched Fields Indicator | One-Line Reason Template (EN / VI) |
|---|---|---|---|
| **`GENUINE`** | `hasId === true` **AND** `hasName === true` in the same source document (via title/snippet/URL or fetched document text/combined exact-match query verification). | `Matched: Student ID + Student Name` / `Khớp: Mã số sinh viên + Họ và tên` | `"Both your exact 10-digit Student ID and normalized full name appear together in this public source."` / `"Cả Mã số sinh viên (10 chữ số) và Họ tên (đã chuẩn hóa) đều xuất hiện trong cùng nguồn công khai này."` |
| **`FALSE POSITIVE`** (Case 1: ID Only) | `hasId === true` **AND** `hasName === false` (even after secondary page/query check). | `Matched: Student ID only` / `Chỉ khớp: Mã số sinh viên` | `"Only the 10-digit number matched; your student name was not confirmed in the public preview (may be an unrelated number or requires manual check)."` / `"Chỉ khớp chuỗi 10 chữ số; không xác nhận thấy họ tên của bạn trong bản xem trước công khai (có thể là dãy số ngẫu nhiên hoặc cần kiểm tra thủ công)."` |
| **`FALSE POSITIVE`** (Case 2: Name Only) | `hasId === false` **AND** `hasName === true`. | `Matched: Student Name only` / `Chỉ khớp: Họ và tên` | `"Only a matching name was found without your 10-digit Student ID (common name collision / needs manual check)."` / `"Chỉ tìm thấy họ tên trùng khớp nhưng không có Mã số sinh viên 10 chữ số (trùng tên phổ biến / cần kiểm tra thủ công)."` |

- **No Raw Snippet / Third-Party PII Echoing:** Regardless of verdict, the result card displays **ONLY**:
  1. **Source Name & Type** (e.g., `Scribd Document Repository (scribd.com)`, `HCMC Open University Portal (ou.edu.vn)`, `Public PDF Document`, `Public Web Source (<hostname>)`),
  2. **Direct HTTPS Link** (validated `https://...` anchor with `rel="noopener noreferrer" target="_blank"`),
  3. **Verdict Badge** (`GENUINE` or `FALSE POSITIVE`),
  4. **Matched Fields Indicator** (`Student ID + Student Name`, `Student ID only`, or `Student Name only`),
  5. **Standardized One-Line Reason** (from the deterministic template above — never raw scraped text snippets from the source document, because source rosters often list dozens of other students' names, birthdates, and IDs on the same line!).
- **Zero-Result Requirement:** When no matching sources are found, the UI displays a clear empty state and MUST include the exact required warning:
  - English: **"absence of results does not prove your data is not exposed"**
  - Vietnamese: **"Việc không tìm thấy kết quả không chứng minh rằng dữ liệu của bạn chưa từng bị lộ."**

---

## Section b) Impeccable Framework Design-Rules Summary & Official OU Blue Hex

### 1. Official Ho Chi Minh City Open University (OU) Signature Blue Verification
We verified the official Ho Chi Minh City Open University (`ou.edu.vn`) brand colors across three authoritative sources:
1. **Repository Root `README.md`:** Uses the official OU shield badge `<img src="https://img.shields.io/badge/OU-005BAC?logo=bookstack&logoColor=white" alt="Ho Chi Minh City Open University" />` specifying **`#005BAC`** as the primary OU signature brand blue.
2. **Official `ou.edu.vn` Production Stylesheets (`https://ou.edu.vn/wp-content/themes/education/style_phe.css`, `css/style_l.css`, and `style.css`):**
   - Primary UI accent blue on `ou.edu.vn` headers, section banners, buttons, and active links: **`#1956B3`** (RGB `25, 86, 179`) and content link blue **`#1D559F`** (RGB `29, 85, 159`).
   - Deep institutional heading ink on `ou.edu.vn`: **`#000022`**.
3. **Harmonized Palette & WCAG AA Contrast Ratios:**
   We anchor our design tokens in `styles.css` on Official OU Signature Blue **`#005BAC`** (with `#1956B3` as the official `ou.edu.vn` web stylesheet companion and `#003E78` as the darkened hover/focus variant):
   - **`--ou-blue-primary: #005BAC`** on pure white `#FFFFFF` surface → **Contrast Ratio: `6.84:1`** (Passes WCAG AA `4.5:1` for normal text and `3.0:1` for large text/UI controls; approaches AAA).
   - **`--ou-blue-web: #1956B3`** (`ou.edu.vn` CSS header blue) on `#FFFFFF` → **Contrast Ratio: `6.81:1`** (Passes WCAG AA).
   - **`--ou-blue-deep: #003E78`** (active/heading accent) on `#FFFFFF` → **Contrast Ratio: `10.45:1`** (Passes WCAG AAA).
   - **`--ink-primary: #0B192C`** (deep academic navy-ink on `#F6F8FB` canvas) → **Contrast Ratio: `16.2:1`** (Passes WCAG AAA).
   - **`--ink-secondary: #33475B`** (tinted slate-blue secondary text, avoiding neutral gray on tinted surfaces) on `#F6F8FB` → **Contrast Ratio: `8.6:1`** (Passes WCAG AAA).
   - **Verdict Badges (Dual-Encoded with Icon/Label + Color):**
     - `GENUINE` (High-Attention Exposure Alert): Background `#FCECEB`, Border `#B83227`, Text `#7F1B13` → **Contrast Ratio: `8.35:1`** (Passes WCAG AAA).
     - `FALSE POSITIVE` (Amber Manual-Check Notice): Background `#FDF3E1`, Border `#9E6208`, Text `#663D00` → **Contrast Ratio: `7.42:1`** (Passes WCAG AAA).
     - `INFO / SAFE NOTICE`: Background `#E6F0F8`, Border `#005BAC`, Text `#003E78` → **Contrast Ratio: `9.10:1`** (Passes WCAG AAA).

### 2. Design Rules We Will Apply (Impeccable Framework v4.10.0)
Derived directly from `pbakaus/impeccable` (`SKILL.md`, `DESIGN.md`, `reference/mode-operate.md`, `reference/craft-floor.md`, `reference/typeset.md`, `reference/layout.md`, `reference/colorize.md`, `reference/harden.md`, `reference/clarify.md`, and `reference/audit.md`), `vtthanh-implementor` MUST apply the following concrete rules:

1. **Surface Mode (`Operate` + `Read` Hybrid):**
   - Visitors arrive to perform a high-trust privacy self-check (`Operate`) and understand the verdict/disclaimer (`Read`).
   - Ambition shows as **precision, restraint, and immediate scannability**. The interface must read immediately as a trustworthy academic security self-check instrument—no marketing fluff, no fake dashboards, no decorative clutter.
2. **Strict Anti-Slop Bans (`craft-floor.md` & Detector Rules):**
   - **NO Eyebrows / Kickers Above Headings:** Never place a small uppercase label/pill directly above an `<h1>` or `<h2>`. Let the heading carry its own weight.
   - **NO Card-in-Card Nesting:** Never nest a `.card` inside another bordered/shadowed `.card`. Group related items with spatial proximity (`gap`) and hairline dividers (`1px solid var(--border-subtle)`) instead of wrapping every element in a box.
   - **NO One-Sided Accent Bars (`side-tab` ban):** Never put a `border-left: 4px solid ...` on alerts, cards, or findings. Use a full `1px solid` semantic border, a subtle tinted surface background, and a leading status badge/icon.
   - **NO Purple-to-Blue Gradients, Gradient Text, Neon Dark Glows, or Decorative Glassmorphism:** No `background-clip: text`, no `backdrop-filter: blur()` decoration, and no zero-offset glowing shadows.
   - **NO Icon-Tile Stacks or Hero-Metric Clichés:** Do not place rounded-square icon tiles above section headings, and do not render fake "01 / 02 / 03" step numbers or decorative sparklines/progress rings.
   - **NO Emoji as UI Icons:** Never use raw emoji as structural UI icons. Use clean, authored inline SVGs with consistent `1.75px` stroke width and `aria-hidden="true"`.
3. **Typography & Hierarchy (`typeset.md`):**
   - **Font Stack (Zero External Network Requests for Fonts):** To satisfy strict supply-chain (`CWE-829`) and CSP (`font-src 'self'`) rules while respecting Vietnamese diacritics and OU's typography:
     - Primary UI & Body (`--font-sans`): `"Be Vietnam Pro", "Segoe UI Variable Text", "Segoe UI", Roboto, system-ui, -apple-system, sans-serif`.
     - Monospace (`--font-mono`, strictly for the 10-digit Student ID input, verdict tags, HTTP status/domain metadata — **"The Mono Means Machine Rule"**): `ui-monospace, "Cascadia Mono", "SF Mono", "JetBrains Mono", Consolas, monospace`.
   - **Scale & Measure:**
     - Body text floor: `1rem` (`16px`) across all viewports (critical on mobile so iOS Safari never force-zooms focused `<input>` elements).
     - Clear hierarchy (>1.25× step between main heading and body): `h1` at `clamp(1.5rem, 2.6vw, 2rem)` (`font-weight: 700`, `letter-spacing: -0.02em`, `text-wrap: balance`), `h2` at `1.25rem` (`font-weight: 700`), body at `1rem` (`line-height: 1.6`, `text-wrap: pretty`).
     - Reading measure constrained to `60ch–72ch` (`max-width: 740px` main column) so long bilingual explanations and legal clauses never stretch past `80ch`.
     - Use `font-variant-numeric: tabular-nums` on Student ID inputs, counters, and timestamps.
4. **Layout, Spacing & Touch Targets (`layout.md` & `audit.md`):**
   - **4px Base Spacing Scale:** `--sp-1: 4px`, `--sp-2: 8px`, `--sp-3: 12px`, `--sp-4: 16px`, `--sp-5: 20px`, `--sp-6: 24px`, `--sp-8: 32px`, `--sp-10: 40px`.
   - **Interactive Touch Targets:** Every `<button>`, `<input>`, and link button must have a minimum interactive height/width of **`44px × 44px`** (`min-height: 44px`) and internal padding `>= 12px`.
   - **Browser Surfaces Themed:** Explicitly style `::selection` (OU Blue tint), `caret-color: var(--ou-blue-primary)`, and `:focus-visible` (`outline: 2px solid var(--ou-blue-primary); outline-offset: 2px`).
5. **Hardening, Copy & States (`harden.md` & `clarify.md`):**
   - **Persistent Form Labels:** `<label for="student-id">` and `<label for="student-name">` are always visible above inputs, with format rules shown upfront before submission.
   - **Motion Sensitivity:** Respect `@media (prefers-reduced-motion: reduce)` by replacing spinner animations with static/opacity indicators without removing state feedback.

---

## Section c) Architecture, File List, and Security Design Mapped to CWE Checklist

### 1. Exact File List in `Course-Projects-From-OU-Students/vibe-code-project/`
All files for this tool reside directly inside `vibe-code-project/`. We **do not touch** `vibe-code-project/hcmc-ou-a-search/` or its contents.

| File Path (relative to repo root) | Role & Responsibilities |
|---|---|
| `vibe-code-project/index.html` | Main self-check application page (bilingual VI/EN support). Includes strict `<meta http-equiv="Content-Security-Policy">`, semantic landmarks (`<header>`, `<main>`, `<form>`, `<section aria-live="polite">`, `<footer>`), persistent labels, privacy self-check framing, and footer link to `./disclaimer.html`. |
| `vibe-code-project/disclaimer.html` | Standalone bilingual (Vietnamese & English) Legal Disclaimer, Privacy & Terms of Use page covering all required clauses, with the same strict CSP meta tag and footer link back to `./index.html` and `./disclaimer.html`. |
| `vibe-code-project/404.html` | Clean static Not-Found fallback page inside `vibe-code-project/` with strict CSP and navigation back to `./index.html` and `./disclaimer.html`. |
| `vibe-code-project/styles.css` | Shared stylesheet implementing Official OU Blue (`#005BAC` / `#1956B3`) design tokens, WCAG AA/AAA verified contrast pairs, Impeccable craft-floor rules, responsive layout (`320px` to desktop), `44px` minimum touch targets, and `@media (prefers-reduced-motion: reduce)`. |
| `vibe-code-project/app.js` | Pure vanilla ES2022 client-side logic: frame-busting check, input validation (`^\d{10}$` and Unicode name validation), Vietnamese diacritic normalization (`NFD` + `đ/Đ -> d`), multi-proxy/multi-engine exposure discovery & deep verification, deterministic `GENUINE` vs `FALSE POSITIVE` grading, strict `https:` URL sanitizer, and safe DOM rendering via `document.createElement` + `textContent` only. |
| `vibe-code-project/app.test.js` | Automated Node.js (`node --test`) verification suite testing input validation, ReDoS immunity, Vietnamese normalization, `GENUINE` vs `FALSE POSITIVE` verdict logic, PII redaction, URL protocol sanitization, and static source scans for `innerHTML`/prohibited patterns. |
| `vibe-code-project/PLAN.md` | This comprehensive architecture, research, design, security, deployment, and disclaimer specification document. |
| `vibe-code-project/DECISIONS.md` | Record of conservative architectural, security, privacy, and UX decisions made during Phase 1 & Phase 2. |
| `vibe-code-project/README.md` | Existing reflection note (preserved; appended with concise local run/test and live GitHub Pages documentation). |

### 2. Security Design Mapped Explicitly to CWE Checklist

- **CWE-79 (XSS):** Zero `innerHTML`, `outerHTML`, `insertAdjacentHTML`, `document.write`, `eval`, `Function`, or inline event handlers. Dynamic strings rendered exclusively via `document.createElement` + `textContent`. Strict `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'self'; style-src 'self'; connect-src https://api.allorigins.win https://api.codetabs.com https://corsproxy.io https://thingproxy.freeboard.io https://r.jina.ai; img-src 'self' data:; font-src 'self'; base-uri 'none'; form-action 'none'; object-src 'none';" />` with no `unsafe-inline` and no `unsafe-eval`.
- **CWE-352 (CSRF):** Stateless client-side architecture with no cookies, no sessions, `form-action 'none'`, and `credentials: "omit"` on outbound `fetch()`.
- **CWE-89 (SQLi) / CWE-78 (Command Injection) / CWE-94 (Code Injection):** No database, no shell execution, and no dynamic code evaluation.
- **CWE-601 (Open Redirect) & CWE-1021 (Clickjacking):** Outbound links validated via `new URL()` to allow `https:` only; all links use `rel="noopener noreferrer"` and `target="_blank"`; no redirects driven by user input. Documented that GitHub Pages cannot set HTTP response headers like `X-Frame-Options` or `frame-ancestors`, mitigated via client-side top-frame check (`window.top !== window.self`).
- **CWE-20 / CWE-1333 (Input Validation / ReDoS):** Strict allowlist validation (`^\d{10}$` for ID; 2..80 chars `/^[\p{L}\s'.\-]+$/u` for Name), `escapeRegExp`, and 512 KB payload cap.
- **CWE-798 / CWE-200 (Secrets / Info Exposure):** Zero API keys or secrets; zero `localStorage`/`sessionStorage`/cookies; third-party PII stripped from all findings.
- **CWE-829 / CWE-1104 (Supply Chain):** Zero external runtime dependencies.
- **CWE-319 (Cleartext Transmission):** HTTPS-only `connect-src` and outbound link validator.

---

## Section d) GitHub Pages Deployment Plan

- **Source:** `main` branch root (`/`).
- **Relative Paths:** All assets and links in `vibe-code-project/` use `./styles.css`, `./app.js`, `./disclaimer.html`, and `./index.html` so they resolve identically on local static servers and on GitHub Pages at `https://JuniorThanhBQ.github.io/Course-Projects-From-OU-Students/vibe-code-project/`.
- **Coexistence:** `vibe-code-project/hcmc-ou-a-search/` remains 100% untouched.

---

## Section e) `disclaimer.html` Content Specification

`vibe-code-project/disclaimer.html` provides a complete bilingual (English + Vietnamese) legal disclaimer linked from the footer of every page (`index.html`, `disclaimer.html`, `404.html`), covering:
1. Non-affiliation with Ho Chi Minh City Open University (OU);
2. Informational & educational self-check use only ("check your own information");
3. Provided "AS IS" without warranty of any kind;
4. Accuracy limitations and mandatory warning: `"absence of results does not prove your data is not exposed"`;
5. Zero storage, zero logging, third-party PII redaction, and public CORS proxy transmission disclosure;
6. External third-party links not controlled by this tool;
7. Not legal, cybersecurity, or professional advice;
8. Contact & takedown route via GitHub Issues;
9. Explicit recommendation that the repository owner have the disclaimer text reviewed by a qualified lawyer, because a disclaimer reduces but cannot eliminate legal risk.
