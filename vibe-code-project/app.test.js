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
  // Valid 10-digit IDs
  assert.equal(app.validateStudentId("0000000000").valid, true);
  assert.equal(app.validateStudentId("  1234567890  ").valid, true);
  assert.equal(app.validateStudentId("  1234567890  ").value, "1234567890");

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
  }

  // Required user-facing strings in index.html & disclaimer.html
  assert.ok(
    indexHtml.includes("absence of results does not prove your data is not exposed"),
    "index.html must include mandatory absence-of-results warning"
  );
  assert.ok(
    disclaimerHtml.includes("absence of results does not prove your data is not exposed"),
    "disclaimer.html must include mandatory absence-of-results warning"
  );
  assert.ok(
    disclaimerHtml.toLowerCase().includes("qualified lawyer"),
    "disclaimer.html must recommend review by a qualified lawyer"
  );

  // Official OU Blue (#005BAC and #1956B3) in styles.css
  assert.ok(stylesCss.toUpperCase().includes("#005BAC"), "styles.css must define Official OU Blue #005BAC");
  assert.ok(stylesCss.toUpperCase().includes("#1956B3"), "styles.css must define Official OU Web Blue #1956B3");
});
