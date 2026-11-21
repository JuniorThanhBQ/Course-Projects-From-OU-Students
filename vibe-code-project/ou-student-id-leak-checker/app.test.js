/**
 * Automated Verification Suite for OU Student ID & Name Exposure Self-Check Tool
 * Run via: `node --test vibe-code-project/app.test.js`
 */

"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const app = require("./app.js");

const PROJECT_DIR = __dirname;

test("1. Input Validation: Student ID (`^\\d{10}$`) & Student Name rules (CWE-20)", () => {
  // Valid 10-digit IDs (including full-width Unicode digit normalization F5)
  assert.equal(app.validateStudentId("0000000000").valid, true);
  assert.equal(app.validateStudentId("  1234567890  ").valid, true);
  assert.equal(app.validateStudentId("  1234567890  ").value, "1234567890");
  assert.equal(app.validateStudentId("１２３４５６７８９０").valid, true);
  assert.equal(app.validateStudentId("１２３４５６７８９０").value, "1234567890");

  // Invalid Student IDs: empty, 9 digits, 11 digits, letters, XSS payload
  assert.equal(app.validateStudentId("").valid, false);
  assert.equal(app.validateStudentId("12345").valid, false);
  assert.equal(app.validateStudentId("123456789").valid, false);
  assert.equal(app.validateStudentId("12345678901").valid, false);
  assert.equal(app.validateStudentId("12345abcde").valid, false);
  assert.equal(app.validateStudentId("<script>12</script>").valid, false);

  // Valid Vietnamese and ASCII Student Names
  const validNameVi = app.validateStudentName("  Nguyễn   Văn   Đức  ");
  assert.equal(validNameVi.valid, true);
  assert.equal(validNameVi.value, "Nguyễn Văn Đức");
  assert.equal(validNameVi.normalized, "nguyen van duc");

  // Invalid Student Names: empty, 1 char, >80 chars, digits, HTML/XSS tags
  assert.equal(app.validateStudentName("").valid, false);
  assert.equal(app.validateStudentName("A").valid, false);
  assert.equal(app.validateStudentName("A".repeat(81)).valid, false);
  assert.equal(app.validateStudentName("Nguyen Van A 123").valid, false);
  assert.equal(app.validateStudentName("<img src=x onerror=alert(1)>").valid, false);
  assert.equal(app.validateStudentName("javascript:alert(1)").valid, false);
});

test("2. Vietnamese Diacritic & đ/Đ Normalization (`normalizeText`)", () => {
  assert.equal(app.normalizeText("Nguyễn Thị Đặng Hoàng"), "nguyen thi dang hoang");
  assert.equal(app.normalizeText("ĐỖ TRẦN BẢO NGỌC"), "do tran bao ngoc");
  assert.equal(app.normalizeText("  Lê-Văn_An   "), "le van an");
  // Decomposed NFD input should normalize identically to precomposed NFC input
  const nfc = "Trần Đức Minh".normalize("NFC");
  const nfd = "Trần Đức Minh".normalize("NFD");
  assert.equal(app.normalizeText(nfc), "tran duc minh");
  assert.equal(app.normalizeText(nfd), "tran duc minh");
});

test("3. ReDoS Immunity & Bounding on Large / Adversarial Inputs (CWE-1333)", () => {
  const start = Date.now();
  const hugeInput = "a".repeat(50000) + "!";
  const vName = app.validateStudentName(hugeInput);
  assert.equal(vName.valid, false);

  const hugeDoc = "0123456789 ".repeat(40000) + " Nguyen Van A";
  const hasId = app.containsExactStudentId(hugeDoc, "1234567890");
  const hasName = app.containsNormalizedStudentName(hugeDoc, "Nguyễn Văn A");
  const elapsedMs = Date.now() - start;

  assert.equal(hasId, false);
  assert.equal(hasName, true);
  assert.ok(elapsedMs < 1000, "Matching must complete in linear time (<1000ms)");
});

test("4. Strict HTTPS URL Sanitizer & Scribd Domain Canonicalization (CWE-601, CWE-319)", () => {
  // Rejects dangerous schemes and credentials
  assert.equal(app.sanitizeHttpsUrl("javascript:alert(1)"), null);
  assert.equal(app.sanitizeHttpsUrl("data:text/html,<script>alert(1)</script>"), null);
  assert.equal(app.sanitizeHttpsUrl("vbscript:msgbox(1)"), null);
  assert.equal(app.sanitizeHttpsUrl("http://www.scribd.com/document/100000001/Sample"), null);
  assert.equal(app.sanitizeHttpsUrl("https://user:pass@www.scribd.com/document/100000001"), null);

  // Canonicalizes regional Scribd domains and strips tracking params
  assert.equal(
    app.sanitizeHttpsUrl("https://vi.scribd.com/document/100000001/Test-Roster?utm_source=test#section"),
    "https://www.scribd.com/document/100000001/Test-Roster"
  );
  assert.equal(
    app.sanitizeHttpsUrl("https://es.scribd.com/doc/100000001/Test-Roster"),
    "https://www.scribd.com/document/100000001/Test-Roster"
  );
  // Rejects non-document Scribd utility/auth/profile links
  assert.equal(app.sanitizeHttpsUrl("https://www.scribd.com/upload-document"), null);
  assert.equal(app.sanitizeHttpsUrl("https://www.scribd.com/oauth/signup"), null);
  assert.equal(app.sanitizeHttpsUrl("https://www.scribd.com/users/12345"), null);
  assert.equal(app.sanitizeHttpsUrl("https://support.scribd.com/hc/en-us"), null);

  // Unwraps DuckDuckGo and Yahoo redirect links
  const ddgWrapped = "https://duckduckgo.com/l/?uddg=" + encodeURIComponent("https://www.scribd.com/document/100000002/Test-File");
  assert.equal(
    app.sanitizeHttpsUrl(ddgWrapped),
    "https://www.scribd.com/document/100000002/Test-File"
  );

  const yahooWrapped = "https://r.search.yahoo.com/_ylt=A00/RU=" + encodeURIComponent("https://www.scribd.com/document/100000003/Test-Doc") + "/RK=2/RS=xyz";
  assert.equal(
    app.sanitizeHttpsUrl(yahooWrapped),
    "https://www.scribd.com/document/100000003/Test-Doc"
  );
});

test("5. Verdict Grading (`GENUINE` vs `FALSE POSITIVE`) & Strict Third-Party PII Redaction (CWE-200)", () => {
  const sampleId = "1234567890";
  const sampleName = "Nguyễn Văn An";
  const thirdPartyPiiSnippet =
    "Danh sách lớp: 1234567890 - Nguyễn Văn An | 9876543210 - Lê Thị Bích (SĐT: 0909123456, Ngày sinh: 01/01/2004)";

  // Case A: Both ID and Name present -> GENUINE
  const genuineFinding = app.evaluateCandidateVerdict(
    {
      url: "https://vi.scribd.com/document/100000099/Danh-Sach-Sinh-Vien",
      title: "Danh sách sinh viên",
      snippet: thirdPartyPiiSnippet
    },
    sampleId,
    sampleName
  );
  assert.ok(genuineFinding);
  assert.equal(genuineFinding.verdict, "GENUINE");
  assert.equal(genuineFinding.url, "https://www.scribd.com/document/100000099/Danh-Sach-Sinh-Vien");
  assert.equal(genuineFinding.hasId, true);
  assert.equal(genuineFinding.hasName, true);

  // Verify third-party PII from snippet is NEVER included in the output finding object
  const serializedFinding = JSON.stringify(genuineFinding);
  assert.equal(serializedFinding.includes("9876543210"), false);
  assert.equal(serializedFinding.includes("0909123456"), false);
  assert.equal(serializedFinding.includes("Lê Thị Bích"), false);

  // Case B: Only ID present -> FALSE POSITIVE
  const idOnlyFinding = app.evaluateCandidateVerdict(
    {
      url: "https://example.edu.vn/notice.pdf",
      title: "Order number 1234567890",
      snippet: "Reference ID 1234567890 without any matching student name"
    },
    sampleId,
    sampleName
  );
  assert.ok(idOnlyFinding);
  assert.equal(idOnlyFinding.verdict, "FALSE POSITIVE");
  assert.equal(idOnlyFinding.hasId, true);
  assert.equal(idOnlyFinding.hasName, false);

  // Case C: Only Name present -> FALSE POSITIVE
  const nameOnlyFinding = app.evaluateCandidateVerdict(
    {
      url: "https://example.org/alumni-list",
      title: "Alumni Nguyen Van An profile",
      snippet: "Congratulating Nguyen Van An on graduation"
    },
    sampleId,
    sampleName
  );
  assert.ok(nameOnlyFinding);
  assert.equal(nameOnlyFinding.verdict, "FALSE POSITIVE");
  assert.equal(nameOnlyFinding.hasId, false);
  assert.equal(nameOnlyFinding.hasName, true);

  // Case D: Neither present -> null (filtered out)
  const unrelated = app.evaluateCandidateVerdict(
    {
      url: "https://example.com/unrelated",
      title: "Unrelated article",
      snippet: "Nothing matching here"
    },
    sampleId,
    sampleName
  );
  assert.equal(unrelated, null);
});

test("6. End-to-End Pipeline (`runExposureSearch`) with Mocked SERP & Deep Document Verification", async () => {
  const testId = "1020304050";
  const testName = "Trần Minh Khoa";

  const mockFetch = async (requestUrl) => {
    // Simulate SERP returning a Scribd URL with only the ID visible in the short snippet,
    // and deep verification of the Scribd URL returning both the 10-digit ID and the Vietnamese name.
    if (requestUrl.includes("100000777")) {
      return {
        ok: true,
        status: 200,
        text: async () =>
          "Document Title: Danh sach sinh vien. Content row: 1020304050 - Trần Minh Khoa - Khoa CNTT."
      };
    }
    return {
      ok: true,
      status: 200,
      text: async () =>
        '<html><body><a href="https://vi.scribd.com/document/100000777/Danh-Sach-Lop">Danh sach lop</a><p>MSSV: 1020304050 ...</p></body></html>'
    };
  };

  const searchOutcome = await app.runExposureSearch(testId, testName, {
    fetchImpl: mockFetch
  });

  assert.equal(searchOutcome.anyNetworkSuccess, true);
  assert.equal(searchOutcome.findings.length, 1);
  assert.equal(searchOutcome.findings[0].verdict, "GENUINE");
  assert.equal(
    searchOutcome.findings[0].url,
    "https://www.scribd.com/document/100000777/Danh-Sach-Lop"
  );
});

test("7. Static Security Audit: Zero Dangerous DOM Sinks (CWE-79), Strict CSP, Required Copy & Official OU Blue", () => {
  const appJsSource = fs.readFileSync(path.join(PROJECT_DIR, "app.js"), "utf8");
  const indexHtml = fs.readFileSync(path.join(PROJECT_DIR, "index.html"), "utf8");
  const disclaimerHtml = fs.readFileSync(path.join(PROJECT_DIR, "disclaimer.html"), "utf8");
  const notFoundHtml = fs.readFileSync(path.join(PROJECT_DIR, "404.html"), "utf8");
  const stylesCss = fs.readFileSync(path.join(PROJECT_DIR, "styles.css"), "utf8");

  // CWE-79: Zero dangerous DOM sinks in app.js
  const forbiddenJsTokens = [
    "inner" + "HTML",
    "outer" + "HTML",
    "insertAdjacent" + "HTML",
    "document.write",
    "eval("
  ];
  for (const token of forbiddenJsTokens) {
    assert.equal(
      appJsSource.includes(token),
      false,
      "app.js must not contain dangerous DOM sink: " + token
    );
  }

  // Verify strict CSP without unsafe-inline or unsafe-eval on all HTML pages
  for (const [pageName, html] of [
    ["index.html", indexHtml],
    ["disclaimer.html", disclaimerHtml],
    ["404.html", notFoundHtml]
  ]) {
    assert.ok(
      html.includes('http-equiv="Content-Security-Policy"'),
      pageName + " must include Content-Security-Policy meta tag"
    );
    assert.equal(
      html.includes("unsafe-inline"),
      false,
      pageName + " CSP must not allow unsafe-inline"
    );
    assert.equal(
      html.includes("unsafe-eval"),
      false,
      pageName + " CSP must not allow unsafe-eval"
    );
    assert.ok(
      html.includes("./disclaimer.html"),
      pageName + " must link to ./disclaimer.html"
    );
    assert.equal(
      html.includes("corsproxy.io"),
      false,
      pageName + " CSP must not include unused corsproxy.io origin"
    );
    assert.equal(
      html.includes("thingproxy.freeboard.io"),
      false,
      pageName + " CSP must not include unused thingproxy.freeboard.io origin"
    );
  }

  // F5 & S4: Student ID input must enforce maxlength="10" and use placeholder 0000000000
  assert.ok(
    indexHtml.includes('maxlength="10"'),
    'index.html must enforce maxlength="10" on #student-id'
  );
  assert.equal(
    indexHtml.includes("19537" + "42285"),
    false,
    "index.html must not contain real-looking student ID example"
  );

  // Required user-facing strings in index.html & disclaimer.html
  assert.ok(
    indexHtml.includes("absence of results does not prove your data is not exposed"),
    "index.html must include mandatory absence-of-results warning"
  );
  assert.ok(
    disclaimerHtml.includes("absence of results does not prove your data is not exposed"),
    "disclaimer.html must include mandatory absence-of-results warning"
  );
  assert.equal(
    disclaimerHtml.includes("Explicit Note to Repository Owner"),
    false,
    "disclaimer.html must not expose internal repository-owner legal review note publicly"
  );
  assert.ok(
    indexHtml.includes('data-set-lang="en"') && indexHtml.includes('data-set-lang="vi"'),
    "index.html must provide EN / VI language switching controls"
  );

  // Official OU Blue (#005BAC and #1956B3) in styles.css
  assert.ok(stylesCss.toUpperCase().includes("#005BAC"), "styles.css must define Official OU Blue #005BAC");
  assert.ok(stylesCss.toUpperCase().includes("#1956B3"), "styles.css must define Official OU Web Blue #1956B3");
});

test("8. Issue #11 Regressions: Zero Synthetic Verdicts, Query-Echo Stripping, NFD & Proximity Guards, Failover & Dedupe", async () => {
  const testId = "1020304050";
  const testName = "Trần Minh Khoa";

  // 8.1 (F1): Scribd search page with zero matching text -> 0 findings (never auto-confirms confirmedId/confirmedName)
  const zeroMatchOutcome = await app.runExposureSearch(testId, testName, {
    fetchImpl: async () => ({
      ok: true,
      status: 200,
      text: async () =>
        '<html><body><a href="https://vi.scribd.com/document/900000001/Unrelated-Book">Unrelated Book</a><p>General academic syllabus with no student identifiers.</p></body></html>'
    })
  });
  assert.equal(zeroMatchOutcome.anyNetworkSuccess, true);
  assert.equal(zeroMatchOutcome.findings.length, 0);

  // 8.2 (F4): Search page echoing the query string on unrelated docs -> 0 GENUINE findings
  const echoedQueryOutcome = await app.runExposureSearch(testId, testName, {
    fetchImpl: async () => ({
      ok: true,
      status: 200,
      text: async () =>
        '<html><head><title>Search results for "1020304050" "Trần Minh Khoa" | Scribd</title></head>' +
        '<body><h1>Search results for "1020304050" "Trần Minh Khoa"</h1>' +
        '<div class="results"><a href="https://vi.scribd.com/document/900000002/Calculus-Notes">Calculus Notes</a>' +
        "<p>Integration by parts and differential equations study guide.</p></div></body></html>"
    })
  });
  assert.equal(
    echoedQueryOutcome.findings.filter((f) => f.verdict === "GENUINE").length,
    0,
    "Echoed search query header must never cause unrelated docs to be graded GENUINE"
  );
  assert.equal(echoedQueryOutcome.findings.length, 0);

  // 8.3 (F2): Combined-query page containing only the Student ID without the name -> FALSE POSITIVE, never GENUINE
  const idOnlyOutcome = await app.runExposureSearch(testId, testName, {
    fetchImpl: async () => ({
      ok: true,
      status: 200,
      text: async () =>
        '<html><body><a href="https://ou.edu.vn/thong-bao-1020304050.pdf">Thong bao</a><p>Ma ho so: 1020304050 (khong co ten sinh vien).</p></body></html>'
    })
  });
  assert.equal(idOnlyOutcome.findings.length, 1);
  assert.equal(idOnlyOutcome.findings[0].verdict, "FALSE POSITIVE");
  assert.equal(idOnlyOutcome.findings[0].hasId, true);
  assert.equal(idOnlyOutcome.findings[0].hasName, false);

  // 8.4 (F3): findings.length > 0 && genuineCount === 0 -> shouldShowEmptyStatePanel(findings) is false
  assert.equal(app.shouldShowEmptyStatePanel(idOnlyOutcome.findings), false);
  assert.equal(app.shouldShowEmptyStatePanel([]), true);

  // 8.5 (F6): NFD-normalized Vietnamese name passes validateStudentName() & single-letter noise is rejected
  const nfdName = "Nguyễn Văn Ánh".normalize("NFD");
  const nfdValidation = app.validateStudentName(nfdName);
  assert.equal(nfdValidation.valid, true);
  assert.equal(nfdValidation.normalized, "nguyen van anh");
  assert.equal(
    app.containsNormalizedStudentName("the van nguyen a company policy handbook", "Nguyễn Văn A"),
    false
  );
  assert.equal(
    app.containsNormalizedStudentName("nguyen and van met a friend yesterday", "Nguyễn Văn A"),
    false
  );
  assert.equal(
    app.containsNormalizedStudentName("Danh sach: Nguyen Van A - Khoa CNTT", "Nguyễn Văn A"),
    true
  );

  // 8.6 (S1, S2, P1/P2, P4): Gateway failover when r.jina.ai returns 403 on scribd.com/search, strict hostname suffix, & query param dedupe
  let jinaCalls = 0;
  let codetabsCalls = 0;
  const failoverOutcome = await app.runExposureSearch(testId, testName, {
    fetchImpl: async (requestUrl) => {
      if (requestUrl.startsWith("https://r.jina.ai/")) {
        jinaCalls += 1;
        return {
          ok: false,
          status: 403,
          text: async () => "Forbidden"
        };
      }
      if (requestUrl.startsWith("https://api.codetabs.com/")) {
        codetabsCalls += 1;
        return {
          ok: true,
          status: 200,
          text: async () =>
            '<html><body><a href="https://vi.scribd.com/document/100000999/Roster-OU">Roster OU</a>' +
            "<p>1020304050 - Trần Minh Khoa</p></body></html>"
        };
      }
      return {
        ok: false,
        status: 503,
        text: async () => "Unavailable"
      };
    }
  });
  assert.ok(jinaCalls > 0, "Primary Jina gateway should be attempted first");
  assert.ok(codetabsCalls > 0, "CodeTabs fallback gateway must be attempted when Jina returns 403 on scribd.com/search");
  assert.equal(failoverOutcome.anyNetworkSuccess, true);
  assert.equal(failoverOutcome.findings.length, 1);
  assert.equal(failoverOutcome.findings[0].verdict, "GENUINE");

  // S1: Lookalike domain must not classify as Scribd or Studocu
  assert.equal(
    app.classifySource("https://evilscribd.com/document/1/x"),
    "Public Web Source (evilscribd.com)"
  );
  assert.equal(
    app.classifySource("https://fakestudocu.com/doc/1"),
    "Public Web Source (fakestudocu.com)"
  );
  assert.equal(
    app.classifySource("https://123docz.net/document/12345.htm"),
    "123doc Document Repository (123docz.net)"
  );

  // P4: Non-Scribd URLs with different query strings must have distinct canonical dedupe keys
  assert.notEqual(
    app.getCanonicalDedupeKey("https://example.com/diem?id=1111"),
    app.getCanonicalDedupeKey("https://example.com/diem?id=2222")
  );

  // P1/P2: Non-overlapping mirror offsets across parallel queries
  const q0Mirrors = app.buildScribdTrackUrls("test", 0).map((e) => e.url);
  const q1Mirrors = app.buildScribdTrackUrls("test", 1).map((e) => e.url);
  const q2Mirrors = app.buildScribdTrackUrls("test", 2).map((e) => e.url);
  for (const url of q0Mirrors) {
    assert.equal(q1Mirrors.includes(url), false, "Query 0 and Query 1 Scribd mirrors must not overlap");
    assert.equal(q2Mirrors.includes(url), false, "Query 0 and Query 2 Scribd mirrors must not overlap");
  }

  // 8.7: Space-separated Scribd PDF table glyph extraction ("5 4 2 3 5 1 0 5 0 1 6 4 V Ă N T R U N G T H À N H")
  const spacedPdfRow =
    "5 3 2 3 5 1 0 5 0 1 6 3 P H Ạ M T Ấ N T H À N H 0 4/1 0/2 0 0 5 I T 2 3 0 3 1 0 8.5 9 c h í n " +
    "5 4 2 3 5 1 0 5 0 1 6 4 V Ă N T R U N G T H À N H 1 3/1 1/2 0 0 5 I T 2 3 0 3 1 0 9 9.3 c h í n.b a";
  assert.equal(app.containsExactStudentId(spacedPdfRow, "2351050164"), true);
  assert.equal(app.containsNormalizedStudentName(spacedPdfRow, "Van Trung Thanh"), true);
  assert.equal(app.containsNormalizedStudentName(spacedPdfRow, "Văn Trung Thành"), true);
});
