# OU Student ID & Name Exposure Self-Check Tool (`ou-student-id-leak-checker`)

**"Are your student ID and name exposed anywhere?"** / **"Mã số sinh viên và họ tên của bạn có bị lộ ở đâu không?"**

A privacy-first, client-side web application for Ho Chi Minh City Open University (OU) students to verify whether their 10-digit Student ID and full name appear together in public web indices or document repositories (such as Scribd, `*.ou.edu.vn`, Studocu, SlideShare, 123doc, GitHub, and public PDFs/spreadsheets).

---

## Key Features & Security Highlights

- **Self-Check Privacy-by-Design (`CWE-200`):** Runs 100% in the browser on static GitHub Pages with zero backend database, zero cookies, zero `localStorage`, zero `sessionStorage`, and zero server logging. Raw text excerpts from source documents are discarded in memory and never rendered so third-party student PII is never re-exposed.
- **Parallel Multi-Track Discovery (Scribd + General Web & `*.ou.edu.vn`):** Queries Track 1 (non-overlapping regional Scribd mirrors with `10,000 ms` timeout) and Track 2 (Yahoo Web Search indexing `*.ou.edu.vn`, `studocu.com`, `slideshare.net`, `123docz.net`, and public PDFs/spreadsheets with `15,000 ms` timeout) concurrently with progressive UI rendering and query-echo stripping (`stripQueryEchoes`).
- **Vietnamese Diacritic Normalization:** Automatically normalizes Vietnamese diacritics (`NFC` / `NFD`, including decomposed combining marks `\p{M}`) and converts `đ/Đ → d` case-insensitively while validating the exact 10-digit Student ID (`^\d{10}$`, with automatic full-width digit normalization).
- **Deterministic Evidence-Based Verdicts (`GENUINE` vs. `FALSE POSITIVE`):** Distinguishes confirmed combined ID + Name exposures (`GENUINE`) from ID-only or Name-only partial matches (`FALSE POSITIVE`) strictly from verified text evidence or deep document verification (up to 4 documents per search).
- **Strict Security Hardening (`CWE-79`, `CWE-601`, `CWE-1021`, `CWE-1333`):** Enforces a strict Content Security Policy (`default-src 'none'; script-src 'self'; style-src 'self'; connect-src https://api.allorigins.win https://api.codetabs.com https://r.jina.ai; ...`), zero `innerHTML`, `https:`-only link validation with `rel="noopener noreferrer"`, and top-frame clickjacking protection.

---

## Project Structure

```text
vibe-code-project/ou-student-id-leak-checker/
├── index.html          # Main bilingual (EN/VI) self-check application UI
├── disclaimer.html     # Bilingual Legal Disclaimer, Privacy Notice & Terms of Use
├── 404.html            # Custom 404 fallback page for the sub-project
├── styles.css          # Official OU Blue (#005BAC / #1956B3) stylesheet
├── app.js              # Pure Vanilla ES2022 client-side search & verdict engine
├── app.test.js         # Automated Node.js unit & static security test suite
├── package.json        # Package manifest (`npm test` -> `node --test app.test.js`)
├── README.md           # Project documentation
└── docs/
    ├── PLAN.md         # Architecture, design rules, CWE mapping & deployment plan
    └── DECISIONS.md    # Architectural & security decision log
```

---

## Local Verification & Running Locally

1. **Run Automated Unit & Security Tests (Node.js 18+):**
   ```bash
   node --test vibe-code-project/ou-student-id-leak-checker/app.test.js
   # Or via npm:
   npm --prefix vibe-code-project/ou-student-id-leak-checker test
   ```
2. **Start a Local Static Server:**
   ```bash
   npx serve .
   # Or using Python:
   python -m http.server 8080 --directory vibe-code-project/ou-student-id-leak-checker
   ```
   Then open `http://localhost:8080/index.html` (or `http://localhost:3000/vibe-code-project/ou-student-id-leak-checker/index.html`) in your browser.

---

## Live GitHub Pages Paths

When deployed via GitHub Pages from the `main` branch root (`/`):
- **Self-Check Tool:** `/Course-Projects-From-OU-Students/vibe-code-project/ou-student-id-leak-checker/` (`index.html`)
- **Legal Disclaimer & Privacy Notice:** `/Course-Projects-From-OU-Students/vibe-code-project/ou-student-id-leak-checker/disclaimer.html`
- **404 Fallback Page:** `/Course-Projects-From-OU-Students/vibe-code-project/ou-student-id-leak-checker/404.html`
