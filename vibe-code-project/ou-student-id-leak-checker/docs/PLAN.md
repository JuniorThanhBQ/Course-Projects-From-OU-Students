# Implementation Plan — OU Student ID & Name Exposure Self-Check Tool

**Project Location:** `vibe-code-project/ou-student-id-leak-checker/` (sibling to `vibe-code-project/hcmc-ou-a-search/`, which MUST NOT be modified)  
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
  2. **Parallel Multi-Track Search Engines & Public CORS Endpoints:**
     The client executes **Track 1 (Scribd Regional Mirrors)** and **Track 2 (General Web & Academic Repositories via Yahoo Search)** concurrently via `Promise.allSettled([runScribdTrack(), runWebTrack()])` with per-request `AbortController` timeouts (`10,000 ms` for Track 1 and deep document fetches; `15,000 ms` for Track 2 Yahoo Web Search):
     - **Search Targets (Parallel Multi-Track SERPs):**
       1. **Track 1 — Regional Scribd Search Mirrors** (`vi.scribd.com`, `id.scribd.com`, `pt.scribd.com`, `es.scribd.com`, `fr.scribd.com`, `de.scribd.com`, `www.scribd.com` at `/search?query=<encoded_query>`) — rotated with a non-overlapping stride of 2 mirrors per query (`buildScribdTrackUrls`) so parallel queries never collide on the same upstream mirror. Track 1 streams preliminary verified results to the UI via `onPartialFindings` as soon as it resolves.
       2. **Track 2 — Yahoo Web Search HTML** (`https://search.yahoo.com/search?p=<encoded_query>&n=15`, `buildWebTrackUrls`) — runs in parallel with Track 1 on primary queries to index `*.ou.edu.vn`, `studocu.com`, `slideshare.net`, `123docz.net`, `github.com`, and public PDF/spreadsheet leaks.
     - **CORS Proxy & Reader Gateways (3 Active Gateways, No API Key Required):**
       1. **Jina Reader API (Primary Gateway)** (`https://r.jina.ai/<target_url>`) — converts public web pages and search URLs into clean Markdown/text with CORS enabled (`Access-Control-Allow-Origin: *`).
       2. **CodeTabs CORS Proxy (Fallback 1)** (`https://api.codetabs.com/v1/proxy?quest=<encoded_target_url>`) — direct raw HTML response with `Access-Control-Allow-Origin: *`, automatically used if `r.jina.ai` returns HTTP 403 or rate-limits on any target (including `scribd.com/search`).
       3. **AllOrigins JSON (Fallback 2)** (`https://api.allorigins.win/get?url=<encoded_target_url>`) — returns `{ contents, status }` with permissive `Access-Control-Allow-Origin: *`.
  3. **Safe Client-Side Parsing (Zero `innerHTML`):**
     - All HTML responses from proxies are parsed strictly using `new DOMParser().parseFromString(rawHtml, "text/html")` into an inert, non-executing `Document` object (or regex/text extraction on inert strings for Markdown/Lite formats).
     - Search engine redirect wrappers (such as DuckDuckGo's `//duckduckgo.com/l/?uddg=<encoded_url>` or Yahoo's `RU=<encoded_url>/RK=...`) are unwrapped and validated via `new URL(candidateUrl)` to extract the canonical destination `https:` URL.
     - Results are deduplicated by canonicalized URL (stripping tracking query parameters like `utm_*`, `srsltid`, and normalizing mobile/regional subdomains like `vi.scribd.com` / `www.scribd.com` while preserving the exact HTTPS link).

### 2. Rate Limits, API Keys, Terms of Service (ToS), and Privacy Caveats
| Aspect | Assessment & Operational Constraint |
|---|---|
| **API Keys / Secrets** | **None (Zero secrets).** No Google Custom Search keys, no SerpApi keys, no Bing API keys, and no proxy tokens are used or committed. |
| **Rate Limits** | Public CORS proxies (`allorigins.win`, `codetabs.com`) and `r.jina.ai` enforce per-IP rate limits (typically 5–60 requests/minute per visitor IP). Because the tool runs in the visitor's own browser, requests are distributed across each student's individual IP rather than concentrated on a single server IP. A client-side cooldown (2 seconds between searches) and `AbortController` cancellation prevent accidental request flooding. |
| **Privacy Caveat of Public Proxies** | When a browser queries a public CORS proxy (`api.allorigins.win`, `api.codetabs.com`, `r.jina.ai`), the search query (`student ID` and `student name`) traverses that third-party proxy over HTTPS. The UI and `disclaimer.html` MUST explicitly disclose this before the user submits a search. |
| **Source Terms of Service (ToS) Risks** | Automated scraping of search engine result pages (SERPs) and document portals via third-party proxies may conflict with search engine ToS or trigger anti-bot CAPTCHAs under heavy traffic. When all automated public proxies fail or are rate-limited, the UI must degrade gracefully with a clear status alert (never fabricated results) and provide safe, user-initiated direct verification links (`rel="noopener noreferrer"`) so the user is never stranded. |
| **Recommended Production Alternative** | For long-term institutional deployment, the final report and `DECISIONS.md` recommend replacing third-party public CORS proxies with a **self-hosted serverless edge proxy** (e.g., a Cloudflare Worker on a custom domain calling an official paid Search API such as Brave Search API or Google Programmable Search Engine with server-held secrets and zero-log policies). Per project constraints, we do **not** add a custom backend server here; everything ships as a pure static GitHub Pages package. |

### 3. Explicit Normalization & Verdict Rules

#### A. Input Validation & Normalization Specification
1. **Student ID (`studentId`):**
   - **Validation Rule:** Normalizes full-width Unicode digits (`\uFF10–\uFF19`) to ASCII `0–9` and must match `/^\d{10}$/` after trimming leading/trailing whitespace (`maxlength="10"` in `index.html`). Any non-digit character, fewer than 10 digits, or more than 10 digits is rejected client-side before any network call.
2. **Student Name (`studentName`):**
   - **Validation Rule:** After trimming and collapsing consecutive whitespace to a single space, length must be between `2` and `80` characters inclusive, must contain at least one Unicode letter (`/\p{L}/u`), and must match `/^[\p{L}\p{M}\s'.\-]+$/u` (linear-time character class supporting both NFC and NFD combining marks `\p{M}`; rejects digits, HTML brackets `< >`, quotes, and script syntax).
   - **Normalization Function (`normalizeText(str)`):**
     ```js
     function normalizeText(input) {
       return String(input)
         .slice(0, MAX_PAYLOAD_CHARS)
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
     - **ID Match (`hasId`):** The candidate document text (title + snippet + URL slug + optional fetched page body, after stripping echoed search query headers via `stripQueryEchoes`) contains the exact 10-digit `studentId` bounded by non-digit boundaries (`new RegExp("(^|\\D)" + escapeRegExp(studentId) + "(\\D|$)").test(rawText)`), preventing partial matches inside 11+ digit phone numbers or timestamps.
     - **Name Match (`hasName`):** `normalizeText(candidateText)` contains the normalized full `studentName` as a contiguous token sequence on word boundaries, OR when a document splits tokens, every token of `normalizedName` (for multi-word names >= 2 tokens) appears within a **75-character proximity window** (`startIdx - 35` to `startIdx + normalizedTarget.length + 40`) with single-character initial adjacency guards to prevent out-of-order single-letter false positives.

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
   - **`--ink-primary: #0B192C`** (deep academic navy-ink on `#F7F9FC` canvas) → **Contrast Ratio: `16.2:1`** (Passes WCAG AAA).
   - **`--ink-secondary: #2E435A`** (tinted slate-blue secondary text, avoiding neutral gray on tinted surfaces) on `#F7F9FC` → **Contrast Ratio: `9.8:1`** (Passes WCAG AAA).
   - **Verdict Badges (Dual-Encoded with Icon/Label + Color):**
     - `GENUINE` (High-Attention Exposure Alert): Background `#FCECEB`, Border `#B83227`, Text `#7F1B13` → **Contrast Ratio: `8.35:1`** (Passes WCAG AAA).
     - `FALSE POSITIVE` (Amber Manual-Check Notice): Background `#FDF3E1`, Border `#9E6208`, Text `#663D00` → **Contrast Ratio: `7.42:1`** (Passes WCAG AAA).

---

## Section c) Architecture, File List, and Security Design Mapped to CWE Checklist

### 1. Exact File List in `Course-Projects-From-OU-Students/vibe-code-project/ou-student-id-leak-checker/`
All files for this tool reside inside `vibe-code-project/ou-student-id-leak-checker/`. We **do not touch** `vibe-code-project/hcmc-ou-a-search/` or its contents.

| File Path (relative to repo root) | Role & Responsibilities |
|---|---|
| `vibe-code-project/ou-student-id-leak-checker/index.html` | Main self-check application page (bilingual VI/EN support). Includes strict `<meta http-equiv="Content-Security-Policy">`, semantic landmarks, persistent labels, privacy self-check framing, and footer link to `./disclaimer.html`. |
| `vibe-code-project/ou-student-id-leak-checker/disclaimer.html` | Standalone bilingual (Vietnamese & English) Legal Disclaimer, Privacy & Terms of Use page covering all required clauses, with the same strict CSP meta tag and footer link back to `./index.html` and `./disclaimer.html`. |
| `vibe-code-project/ou-student-id-leak-checker/404.html` | Clean static Not-Found fallback page inside `vibe-code-project/ou-student-id-leak-checker/` with strict CSP and navigation back to `./index.html` and `./disclaimer.html`. |
| `vibe-code-project/ou-student-id-leak-checker/styles.css` | Shared stylesheet implementing Official OU Blue (`#005BAC` / `#1956B3`) design tokens, WCAG AA/AAA verified contrast pairs, Impeccable craft-floor rules, responsive layout (`320px` to desktop), `44px` minimum touch targets, and `@media (prefers-reduced-motion: reduce)`. |
| `vibe-code-project/ou-student-id-leak-checker/app.js` | Pure vanilla ES2022 client-side logic: frame-busting check, input validation (`^\d{10}$` and Unicode name validation), Vietnamese diacritic normalization (`NFD` + `đ/Đ -> d`), parallel multi-track exposure discovery & deep verification, deterministic `GENUINE` vs `FALSE POSITIVE` grading, strict `https:` URL sanitizer, and safe DOM rendering via `document.createElement` + `textContent` only. |
| `vibe-code-project/ou-student-id-leak-checker/app.test.js` | Automated Node.js (`node --test`) verification suite (8 test suites covering input validation, ReDoS immunity, Vietnamese normalization, `GENUINE` vs `FALSE POSITIVE` verdict logic, PII redaction, URL sanitization, static CSP/DOM audit, and Issue #11 regressions). |
| `vibe-code-project/ou-student-id-leak-checker/package.json` | Package manifest running `node --test app.test.js` via `npm test`. |
| `vibe-code-project/ou-student-id-leak-checker/README.md` | Project documentation and local run instructions. |
| `vibe-code-project/ou-student-id-leak-checker/docs/PLAN.md` | This comprehensive architecture, research, design, security, deployment, and disclaimer specification document. |
| `vibe-code-project/ou-student-id-leak-checker/docs/DECISIONS.md` | Record of conservative architectural, security, privacy, and UX decisions. |

### 2. Strict Content Security Policy (CSP)
Applied via `<meta http-equiv="Content-Security-Policy" ...>` in `<head>` of `index.html`, `disclaimer.html`, and `404.html`, with **NO `unsafe-inline`** and **NO `unsafe-eval`**:
```html
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'self'; style-src 'self'; connect-src https://api.allorigins.win https://api.codetabs.com https://r.jina.ai; img-src 'self' data:; font-src 'self'; base-uri 'none'; form-action 'none'; object-src 'none';" />
```
- **Exact Allowed `connect-src` Origins (3 Active Gateways):**
  1. `https://r.jina.ai` (Primary Reader Gateway)
  2. `https://api.codetabs.com` (Fallback Proxy 1)
  3. `https://api.allorigins.win` (Fallback Proxy 2)
