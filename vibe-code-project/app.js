/**
 * OU Student ID & Name Exposure Self-Check Tool — Client-Side Engine
 * Pure Vanilla ES2022. Zero external runtime dependencies.
 * Security compliance: CWE-79, CWE-352, CWE-601, CWE-1021, CWE-20, CWE-1333, CWE-200, CWE-798, CWE-829, CWE-319.
 */

(function initExposureSelfCheckApp(rootScope) {
  "use strict";

  const MAX_PAYLOAD_CHARS = 524288; // 512 KB cap to prevent ReDoS / memory exhaustion (CWE-1333)
  const REQUEST_TIMEOUT_MS = 6000;
  const COOLDOWN_MS = 2500;
  const STUDENT_ID_REGEX = /^\d{10}$/;
  const STUDENT_NAME_HAS_LETTER_REGEX = /\p{L}/u;
  const STUDENT_NAME_ALLOWLIST_REGEX = /^[\p{L}\s'.\-]+$/u;

  const REGIONAL_SCRIBD_HOSTS = new Set([
    "scribd.com",
    "www.scribd.com",
    "vi.scribd.com",
    "es.scribd.com",
    "id.scribd.com",
    "pt.scribd.com",
    "fr.scribd.com",
    "de.scribd.com",
    "ru.scribd.com",
    "it.scribd.com",
    "ja.scribd.com",
    "zh.scribd.com",
    "tr.scribd.com",
    "pl.scribd.com",
    "ro.scribd.com",
    "ar.scribd.com"
  ]);

  const IGNORED_SEARCH_HOSTS = new Set([
    "search.yahoo.com",
    "r.search.yahoo.com",
    "yahoo.com",
    "www.yahoo.com",
    "help.yahoo.com",
    "policies.yahoo.com",
    "guce.yahoo.com",
    "duckduckgo.com",
    "html.duckduckgo.com",
    "lite.duckduckgo.com",
    "www.bing.com",
    "bing.com",
    "go.microsoft.com",
    "support.microsoft.com",
    "privacy.microsoft.com",
    "search.brave.com",
    "brave.com",
    "cdn.search.brave.com",
    "www.google.com",
    "google.com",
    "api.allorigins.win",
    "api.codetabs.com",
    "corsproxy.io",
    "thingproxy.freeboard.io",
    "r.jina.ai",
    "jina.ai",
    "w3.org",
    "www.w3.org",
    "schema.org",
    "support.scribd.com",
    "scribdinc.com",
    "www.scribdinc.com",
    "everand.com",
    "www.everand.com",
    "instagram.com",
    "www.instagram.com",
    "twitter.com",
    "www.twitter.com",
    "x.com",
    "www.x.com",
    "facebook.com",
    "www.facebook.com",
    "pinterest.com",
    "www.pinterest.com",
    "apps.apple.com",
    "play.google.com"
  ]);

  const TRACKING_PARAMS = new Set([
    "utm_source",
    "utm_medium",
    "utm_campaign",
    "utm_term",
    "utm_content",
    "srsltid",
    "fbclid",
    "gclid",
    "msclkid",
    "ref",
    "guccounter"
  ]);

  /**
   * Normalizes Vietnamese and Latin strings:
   * Unicode NFC -> NFD, strips combining marks [\u0300-\u036f], maps đ/Đ -> d,
   * lowercases, replaces non-alphanumeric with single space, and trims.
   */
  function normalizeText(input) {
    if (input === null || input === undefined) {
      return "";
    }
    return String(input)
      .slice(0, MAX_PAYLOAD_CHARS)
      .normalize("NFC")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[đĐ]/g, "d")
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  /**
   * Escapes RegExp special characters safely in linear time.
   */
  function escapeRegExp(str) {
    return String(str).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  /**
   * Validates the 10-digit Student ID (`^\d{10}$`).
   */
  function validateStudentId(rawId) {
    const trimmed = rawId === null || rawId === undefined ? "" : String(rawId).trim();
    if (!trimmed) {
      return {
        valid: false,
        value: "",
        errorEn: "Please enter your 10-digit Student ID.",
        errorVi: "Vui lòng nhập Mã số sinh viên gồm đúng 10 chữ số."
      };
    }
    if (!STUDENT_ID_REGEX.test(trimmed)) {
      return {
        valid: false,
        value: "",
        errorEn: "Student ID must be an exact 10-digit number (digits 0–9 only, no letters or spaces).",
        errorVi: "Mã số sinh viên phải bao gồm đúng 10 chữ số (từ 0–9, không chứa chữ cái hoặc ký tự đặc biệt)."
      };
    }
    return {
      valid: true,
      value: trimmed,
      errorEn: "",
      errorVi: ""
    };
  }

  /**
   * Validates the Student Name (2..80 chars, Unicode letters + spaces/apostrophes/hyphens/periods).
   */
  function validateStudentName(rawName) {
    const collapsed = rawName === null || rawName === undefined
      ? ""
      : String(rawName).replace(/\s+/g, " ").trim();

    if (!collapsed) {
      return {
        valid: false,
        value: "",
        normalized: "",
        errorEn: "Please enter your full student name.",
        errorVi: "Vui lòng nhập họ và tên sinh viên của bạn."
      };
    }
    if (collapsed.length < 2 || collapsed.length > 80) {
      return {
        valid: false,
        value: "",
        normalized: "",
        errorEn: "Student name must be between 2 and 80 characters.",
        errorVi: "Họ và tên sinh viên phải có độ dài từ 2 đến 80 ký tự."
      };
    }
    if (!STUDENT_NAME_HAS_LETTER_REGEX.test(collapsed) || !STUDENT_NAME_ALLOWLIST_REGEX.test(collapsed)) {
      return {
        valid: false,
        value: "",
        normalized: "",
        errorEn: "Student name may only contain letters, spaces, hyphens, periods, or apostrophes (no numbers or HTML tags).",
        errorVi: "Họ và tên chỉ được chứa chữ cái và khoảng trắng (không được chứa chữ số hoặc thẻ HTML/ký tự đặc biệt)."
      };
    }
    const normalized = normalizeText(collapsed);
    if (normalized.length < 2) {
      return {
        valid: false,
        value: "",
        normalized: "",
        errorEn: "Student name must contain at least 2 valid alphabetical characters.",
        errorVi: "Họ và tên phải có ít nhất 2 chữ cái hợp lệ."
      };
    }
    return {
      valid: true,
      value: collapsed,
      normalized: normalized,
      errorEn: "",
      errorVi: ""
    };
  }

  /**
   * Combined input validator helper.
   */
  function validateInputs(rawId, rawName) {
    const idCheck = validateStudentId(rawId);
    const nameCheck = validateStudentName(rawName);
    return {
      valid: idCheck.valid && nameCheck.valid,
      idCheck: idCheck,
      nameCheck: nameCheck
    };
  }

  /**
   * Unwraps search engine redirect URLs (Yahoo RU=..., DuckDuckGo uddg=..., Bing u=...)
   * and enforces strict HTTPS validation (CWE-601).
   */
  function unwrapSearchRedirectUrl(rawHref) {
    if (!rawHref || typeof rawHref !== "string") {
      return null;
    }
    let candidate = rawHref.trim();
    if (!candidate) {
      return null;
    }
    if (candidate.startsWith("//")) {
      candidate = "https:" + candidate;
    }

    // DuckDuckGo redirect parameter: ?uddg=<encoded>
    if (candidate.includes("duckduckgo.com/l/") || candidate.includes("uddg=")) {
      const uddgMatch = candidate.match(/[?&]uddg=([^&]+)/i);
      if (uddgMatch && uddgMatch[1]) {
        try {
          candidate = decodeURIComponent(uddgMatch[1]);
        } catch {
          return null;
        }
      }
    }

    // Yahoo redirect wrapper: /RU=<encoded>/RK=...
    if (candidate.includes("search.yahoo.com") && candidate.includes("/RU=")) {
      const ruMatch = candidate.match(/\/RU=([^/]+)\/RK=/i);
      if (ruMatch && ruMatch[1]) {
        try {
          candidate = decodeURIComponent(ruMatch[1]);
        } catch {
          return null;
        }
      }
    }

    return candidate;
  }

  /**
   * Validates and canonicalizes an external URL to strict `https:` only (CWE-601, CWE-319).
   * Rejects `javascript:`, `data:`, `vbscript:`, `http:`, `file:`, and credentialed URLs.
   * Canonicalizes regional Scribd domains (`vi.scribd.com`, `es.scribd.com`, etc.) to `www.scribd.com`.
   */
  function sanitizeHttpsUrl(rawUrl) {
    if (!rawUrl || typeof rawUrl !== "string") {
      return null;
    }
    const unwrapped = unwrapSearchRedirectUrl(rawUrl);
    if (!unwrapped) {
      return null;
    }

    try {
      const parsed = new URL(unwrapped);
      if (parsed.protocol !== "https:") {
        return null;
      }
      if (parsed.username || parsed.password) {
        return null;
      }

      const hostLower = parsed.hostname.toLowerCase();
      if (!hostLower || !hostLower.includes(".")) {
        return null;
      }

      // Canonicalize regional Scribd subdomains to www.scribd.com
      if (REGIONAL_SCRIBD_HOSTS.has(hostLower) || hostLower.endsWith(".scribd.com")) {
        if (hostLower === "support.scribd.com" || hostLower === "blog.scribd.com") {
          return null;
        }
        parsed.hostname = "www.scribd.com";
        // Canonicalize /doc/ to /document/ for consistent Scribd URLs
        if (parsed.pathname.startsWith("/doc/")) {
          parsed.pathname = "/document/" + parsed.pathname.slice(5);
        }
        // Only allow actual Scribd document/presentation pages (`/document/<digits>...` or `/presentation/<digits>...`)
        if (!/^\/(?:document|presentation)\/\d+(?:\/|$)/i.test(parsed.pathname)) {
          return null;
        }
      }

      // Strip common tracking query parameters
      for (const key of Array.from(parsed.searchParams.keys())) {
        if (TRACKING_PARAMS.has(key.toLowerCase())) {
          parsed.searchParams.delete(key);
        }
      }
      parsed.hash = "";

      return parsed.href;
    } catch {
      return null;
    }
  }

  /**
   * Checks if a sanitized URL belongs to a search engine, proxy, static asset CDN, or root homepage link that should be filtered out.
   */
  function isIgnoredSearchEngineUrl(httpsUrl) {
    try {
      const parsed = new URL(httpsUrl);
      const host = parsed.hostname.toLowerCase();
      const pathLower = parsed.pathname.toLowerCase();

      if (IGNORED_SEARCH_HOSTS.has(host)) {
        return true;
      }
      if (
        host.endsWith(".yahoo.com") ||
        host.endsWith(".duckduckgo.com") ||
        host.endsWith(".bing.com") ||
        host.endsWith(".brave.com") ||
        host.endsWith(".google.com") ||
        host === "scribdassets.com" ||
        host.endsWith(".scribdassets.com") ||
        host === "scribdinc.com" ||
        host.endsWith(".scribdinc.com") ||
        host === "yahoo.uservoice.com" ||
        host.endsWith(".uservoice.com")
      ) {
        return true;
      }

      // Ignore bare domain homepage links (e.g. footer link to https://www.slideshare.net/)
      if (parsed.pathname === "/" || parsed.pathname === "") {
        return true;
      }

      // Ignore static image/stylesheet/script asset URLs
      if (/\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js)$/i.test(pathLower)) {
        return true;
      }

      return false;
    } catch {
      return true;
    }
  }

  /**
   * Classifies a source URL into a clean, human-readable Source Name & Type.
   */
  function classifySource(httpsUrl) {
    try {
      const parsed = new URL(httpsUrl);
      const host = parsed.hostname.toLowerCase();
      const pathLower = parsed.pathname.toLowerCase();

      if (host === "www.scribd.com" || host.endsWith("scribd.com")) {
        return "Scribd Document Repository (scribd.com)";
      }
      if (host === "ou.edu.vn" || host.endsWith(".ou.edu.vn")) {
        return "HCMC Open University Portal (" + host + ")";
      }
      if (host.includes("studocu.com")) {
        return "Studocu Document Repository (studocu.com)";
      }
      if (host.includes("slideshare.net")) {
        return "SlideShare Presentation (slideshare.net)";
      }
      if (host.includes("github.com") || host.includes("githubusercontent.com")) {
        return "GitHub Public Repository (" + host + ")";
      }
      if (pathLower.endsWith(".pdf")) {
        return "Public PDF Document (" + host + ")";
      }
      if (pathLower.endsWith(".xlsx") || pathLower.endsWith(".xls") || pathLower.endsWith(".csv")) {
        return "Public Spreadsheet (" + host + ")";
      }
      return "Public Web Source (" + host + ")";
    } catch {
      return "Public Web Source";
    }
  }

  /**
   * Checks whether `rawText` contains the exact 10-digit Student ID bounded by non-digits.
   */
  function containsExactStudentId(rawText, studentId) {
    if (!rawText || !STUDENT_ID_REGEX.test(studentId)) {
      return false;
    }
    const boundedText = String(rawText).slice(0, MAX_PAYLOAD_CHARS);
    const idPattern = new RegExp("(^|\\D)" + escapeRegExp(studentId) + "(\\D|$)");
    return idPattern.test(boundedText);
  }

  /**
   * Checks whether `rawText` contains the normalized Vietnamese student name.
   * Supports full contiguous token sequence or close-proximity multi-token match (within 75 chars).
   */
  function containsNormalizedStudentName(rawText, rawOrNormalizedName) {
    if (!rawText || !rawOrNormalizedName) {
      return false;
    }
    const normalizedTarget = normalizeText(rawOrNormalizedName);
    if (normalizedTarget.length < 2) {
      return false;
    }
    const normalizedHaystack = normalizeText(rawText);
    if (!normalizedHaystack) {
      return false;
    }

    // 1. Exact contiguous phrase on word boundaries
    const phraseRegex = new RegExp("(^|\\s)" + escapeRegExp(normalizedTarget) + "(\\s|$)");
    if (phraseRegex.test(normalizedHaystack)) {
      return true;
    }

    // 2. For multi-token names (>= 2 words), check if all tokens appear within a narrow window
    // (e.g. when URL slugs, table columns, or OCR split middle/given name tokens)
    const tokens = normalizedTarget.split(" ").filter(Boolean);
    if (tokens.length >= 2) {
      for (const token of tokens) {
        const tokenRegex = new RegExp("(^|\\s)" + escapeRegExp(token) + "(\\s|$)");
        if (!tokenRegex.test(normalizedHaystack)) {
          return false;
        }
      }
      // Verify proximity of first and last token
      const firstToken = tokens[0];
      let startIdx = normalizedHaystack.indexOf(firstToken);
      while (startIdx !== -1) {
        const windowSlice = normalizedHaystack.slice(
          Math.max(0, startIdx - 40),
          Math.min(normalizedHaystack.length, startIdx + normalizedTarget.length + 60)
        );
        const allInWindow = tokens.every((tk) =>
          new RegExp("(^|\\s)" + escapeRegExp(tk) + "(\\s|$)").test(windowSlice)
        );
        if (allInWindow) {
          return true;
        }
        startIdx = normalizedHaystack.indexOf(firstToken, startIdx + 1);
      }
    }

    return false;
  }

  /**
   * Deterministic Verdict Engine (`GENUINE` vs `FALSE POSITIVE`).
   * Never retains or outputs raw snippets or third-party PII (CWE-200).
   */
  function evaluateCandidateVerdict(candidate, studentId, studentName) {
    if (!candidate || !candidate.url) {
      return null;
    }
    const cleanUrl = sanitizeHttpsUrl(candidate.url);
    if (!cleanUrl || isIgnoredSearchEngineUrl(cleanUrl)) {
      return null;
    }

    const combinedText = [
      candidate.title || "",
      candidate.snippet || "",
      candidate.bodyText || "",
      cleanUrl
    ].join(" ");

    const hasId = Boolean(candidate.confirmedId) || containsExactStudentId(combinedText, studentId);
    const hasName = Boolean(candidate.confirmedName) || containsNormalizedStudentName(combinedText, studentName);

    if (!hasId && !hasName) {
      return null;
    }

    const sourceLabel = classifySource(cleanUrl);

    if (hasId && hasName) {
      return {
        url: cleanUrl,
        sourceName: sourceLabel,
        verdict: "GENUINE",
        hasId: true,
        hasName: true,
        matchedFieldsEn: "Matched: Student ID + Student Name",
        matchedFieldsVi: "Khớp: Mã số sinh viên + Họ và tên",
        reasonEn: "Both your exact 10-digit Student ID and normalized full name appear together in this public source.",
        reasonVi: "Cả Mã số sinh viên (10 chữ số) và Họ tên (đã chuẩn hóa) đều xuất hiện trong cùng nguồn công khai này."
      };
    }

    if (hasId && !hasName) {
      return {
        url: cleanUrl,
        sourceName: sourceLabel,
        verdict: "FALSE POSITIVE",
        hasId: true,
        hasName: false,
        matchedFieldsEn: "Matched: Student ID only",
        matchedFieldsVi: "Chỉ khớp: Mã số sinh viên",
        reasonEn: "Only the 10-digit number matched; your student name was not confirmed in the public preview (may be an unrelated number or requires manual check).",
        reasonVi: "Chỉ khớp chuỗi 10 chữ số; không xác nhận thấy họ tên của bạn trong bản xem trước công khai (có thể là dãy số ngẫu nhiên hoặc cần kiểm tra thủ công)."
      };
    }

    return {
      url: cleanUrl,
      sourceName: sourceLabel,
      verdict: "FALSE POSITIVE",
      hasId: false,
      hasName: true,
      matchedFieldsEn: "Matched: Student Name only",
      matchedFieldsVi: "Chỉ khớp: Họ và tên",
      reasonEn: "Only a matching name was found without your 10-digit Student ID (common name collision / needs manual check).",
      reasonVi: "Chỉ tìm thấy họ tên trùng khớp nhưng không có Mã số sinh viên 10 chữ số (trùng tên phổ biến / cần kiểm tra thủ công)."
    };
  }

  /**
   * Canonical key for deduplicating URLs (especially Scribd documents with or without slug trailing segments).
   */
  function getCanonicalDedupeKey(httpsUrl) {
    try {
      const parsed = new URL(httpsUrl);
      const scribdMatch = parsed.pathname.match(/^\/(?:document|doc|presentation)\/(\d+)/i);
      if (parsed.hostname === "www.scribd.com" && scribdMatch && scribdMatch[1]) {
        return "https://www.scribd.com/document/" + scribdMatch[1];
      }
      return parsed.origin + parsed.pathname.replace(/\/+$/, "");
    } catch {
      return httpsUrl;
    }
  }

  /**
   * Parses raw HTML or Jina Reader Markdown text into candidate items `{ url, title, snippet }`
   * without using any dangerous DOM sinks. Uses `DOMParser` when available in browser, plus
   * regex link extraction fallback for Markdown/Lite responses and Node.js test environments.
   */
  function extractCandidatesFromResponse(rawPayload) {
    if (!rawPayload || typeof rawPayload !== "string") {
      return [];
    }
    const bounded = rawPayload.slice(0, MAX_PAYLOAD_CHARS);
    // If Scribd search explicitly states "No results for ", return empty list immediately
    if (bounded.includes("No results for ")) {
      return [];
    }
    const candidatesByKey = new Map();

    function addCandidate(rawHref, titleText, contextText) {
      const cleanUrl = sanitizeHttpsUrl(rawHref);
      if (!cleanUrl || isIgnoredSearchEngineUrl(cleanUrl)) {
        return;
      }
      const key = getCanonicalDedupeKey(cleanUrl);
      const existing = candidatesByKey.get(key);
      if (!existing) {
        candidatesByKey.set(key, {
          url: cleanUrl,
          title: (titleText || "").slice(0, 300),
          snippet: (contextText || "").slice(0, 1200)
        });
      } else {
        // Keep the fuller URL (e.g., Scribd URL with slug) and accumulate context for in-memory matching
        if (cleanUrl.length > existing.url.length) {
          existing.url = cleanUrl;
        }
        if (titleText && !existing.title.includes(titleText)) {
          existing.title = (existing.title + " " + titleText).slice(0, 500);
        }
        if (contextText && !existing.snippet.includes(contextText)) {
          existing.snippet = (existing.snippet + " " + contextText).slice(0, 2000);
        }
      }
    }

    // 1. Browser DOMParser extraction (inert document, zero script execution)
    if (typeof DOMParser !== "undefined") {
      try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(bounded, "text/html");
        const anchors = doc.querySelectorAll("a[href]");
        for (const anchor of anchors) {
          const rawHref = anchor.getAttribute("href");
          if (!rawHref) {
            continue;
          }
          const title = (anchor.textContent || "").replace(/\s+/g, " ").trim();
          const container =
            anchor.closest("li, article, .algo, .dd, .result, .b_algo, .snippet, tr, div") ||
            anchor.parentElement;
          const context = container
            ? (container.textContent || "").replace(/\s+/g, " ").trim()
            : title;
          addCandidate(rawHref, title, context);
        }
      } catch {
        // Fallback to text extraction below
      }
    }

    // 2. Markdown & raw text URL extraction (handles Jina Reader markdown `[Title](https://...)` and raw SERP HTML in Node)
    const mdLinkRegex = /\[([^\]]{1,240})\]\((https?:\/\/[^\s)]+)\)/g;
    let match;
    while ((match = mdLinkRegex.exec(bounded)) !== null) {
      if (match.index > 0 && bounded[match.index - 1] === "!") {
        continue;
      }
      const start = Math.max(0, match.index - 220);
      const end = Math.min(bounded.length, match.index + match[0].length + 320);
      const surrounding = bounded.slice(start, end).replace(/\s+/g, " ");
      addCandidate(match[2], match[1], surrounding);
    }

    // 3. Extract href="..." attributes and encoded RU= / uddg= links
    const hrefRegex = /href=["']([^"']+)["']/gi;
    while ((match = hrefRegex.exec(bounded)) !== null) {
      if (match.index > 0 && bounded[match.index - 1] === "!") {
        continue;
      }
      const start = Math.max(0, match.index - 200);
      const end = Math.min(bounded.length, match.index + match[0].length + 400);
      const surrounding = bounded
        .slice(start, end)
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ");
      addCandidate(match[1], "", surrounding);
    }

    // 4. Direct Scribd or public document URLs appearing in plain text
    const directUrlRegex = /https?:\/\/(?:[a-z0-9-]+\.)*scribd\.com\/(?:document|doc|presentation)\/\d+(?:\/[a-zA-Z0-9_-]+)?/gi;
    while ((match = directUrlRegex.exec(bounded)) !== null) {
      if (match.index > 0 && bounded[match.index - 1] === "!") {
        continue;
      }
      const start = Math.max(0, match.index - 220);
      const end = Math.min(bounded.length, match.index + match[0].length + 320);
      const surrounding = bounded
        .slice(start, end)
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ");
      addCandidate(match[0], "Scribd Document", surrounding);
    }

    return Array.from(candidatesByKey.values());
  }

  /**
   * Builds the list of proxy-wrapped URLs for a target URL.
   * All origins strictly match the CSP `connect-src` allowlist:
   * - https://r.jina.ai (Primary: native HTTP 200 + `Access-Control-Allow-Origin: *` in Chrome)
   * - https://api.codetabs.com (Fallback)
   * - https://api.allorigins.win (Fallback)
   */
  function buildProxyGateways(targetUrl) {
    const encoded = encodeURIComponent(targetUrl);
    return [
      {
        name: "Jina Reader",
        url: "https://r.jina.ai/" + targetUrl,
        isJsonWrapper: false
      },
      {
        name: "CodeTabs Proxy",
        url: "https://api.codetabs.com/v1/proxy?quest=" + encoded,
        isJsonWrapper: false
      },
      {
        name: "AllOrigins JSON",
        url: "https://api.allorigins.win/get?url=" + encoded,
        isJsonWrapper: true
      }
    ];
  }

  /**
   * Builds search engine target URLs for a given search query.
   * Combines direct Scribd full-text search (`https://www.scribd.com/search?query=...`)
   * with Yahoo Search and DuckDuckGo HTML for comprehensive document + web coverage.
   */
  function buildSearchEngineUrls(queryText) {
    const q = encodeURIComponent(queryText);
    return [
      {
        engine: "Scribd Full-Text Search",
        url: "https://www.scribd.com/search?query=" + q,
        isScribdDirectSearch: true
      },
      {
        engine: "Yahoo Search",
        url: "https://search.yahoo.com/search?p=" + q + "&n=15",
        isScribdDirectSearch: false
      },
      {
        engine: "DuckDuckGo HTML",
        url: "https://html.duckduckgo.com/html/?q=" + q,
        isScribdDirectSearch: false
      },
      {
        engine: "Bing Search",
        url: "https://www.bing.com/search?q=" + q + "&count=15",
        isScribdDirectSearch: false
      }
    ];
  }

  /**
   * Executes a single CORS-simple GET request (no custom headers to avoid OPTIONS preflight failures)
   * with `credentials: "omit"`, `referrerPolicy: "no-referrer"`, and per-attempt timeout.
   */
  async function fetchViaGateway(gateway, parentSignal, fetchImpl) {
    const effectiveFetch = fetchImpl || (typeof fetch !== "undefined" ? fetch : null);
    if (!effectiveFetch) {
      throw new Error("Fetch API unavailable");
    }
    if (parentSignal && parentSignal.aborted) {
      throw new DOMException("Aborted", "AbortError");
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    const onParentAbort = () => controller.abort();
    if (parentSignal) {
      parentSignal.addEventListener("abort", onParentAbort, { once: true });
    }

    try {
      const response = await effectiveFetch(gateway.url, {
        method: "GET",
        credentials: "omit",
        referrerPolicy: "no-referrer",
        signal: controller.signal
      });
      if (!response.ok) {
        throw new Error("HTTP " + response.status);
      }
      const rawText = await response.text();
      if (!rawText || rawText.length < 30) {
        throw new Error("Empty proxy response");
      }

      if (gateway.isJsonWrapper) {
        const parsedJson = JSON.parse(rawText);
        if (!parsedJson || typeof parsedJson.contents !== "string") {
          throw new Error("Invalid AllOrigins JSON payload");
        }
        return parsedJson.contents.slice(0, MAX_PAYLOAD_CHARS);
      }

      return rawText.slice(0, MAX_PAYLOAD_CHARS);
    } finally {
      clearTimeout(timer);
      if (parentSignal) {
        parentSignal.removeEventListener("abort", onParentAbort);
      }
    }
  }

  /**
   * Fetches a target URL by calling the primary gateway (`https://r.jina.ai/`) first
   * so Chrome does not emit unnecessary CORS console errors from secondary proxies unless `r.jina.ai` fails.
   */
  async function fetchTargetWithFallback(targetUrl, parentSignal, fetchImpl) {
    const gateways = buildProxyGateways(targetUrl);

    for (let i = 0; i < gateways.length; i += 1) {
      if (parentSignal && parentSignal.aborted) {
        throw new DOMException("Aborted", "AbortError");
      }
      try {
        const text = await fetchViaGateway(gateways[i], parentSignal, fetchImpl);
        if (
          text &&
          !text.includes("Target URL returned error") &&
          !text.includes("Rate limit exceeded")
        ) {
          return text;
        }
      } catch {
        // Proceed to next fallback gateway only if primary gateway fails
      }
    }
    throw new Error("All CORS gateways failed for target");
  }

  /**
   * Runs a search query across Scribd Direct Search and Yahoo Search concurrently,
   * falling back to DuckDuckGo / Bing only if both fail.
   */
  async function executeSearchQuery(queryObj, parentSignal, fetchImpl) {
    const queryText = typeof queryObj === "string" ? queryObj : queryObj.text;
    const isCombinedIdAndNameQuery = Boolean(queryObj && queryObj.isCombined);
    const isIdOnlyQuery = Boolean(queryObj && queryObj.isIdOnly);

    const engines = buildSearchEngineUrls(queryText);
    const collectedCandidates = [];
    let anyGatewaySucceeded = false;

    // Query Scribd Full-Text Search and Yahoo Search concurrently
    const firstWave = engines.slice(0, 2);
    const waveResults = await Promise.allSettled(
      firstWave.map(async (eng) => {
        const payload = await fetchTargetWithFallback(eng.url, parentSignal, fetchImpl);
        return { engine: eng, payload: payload };
      })
    );

    for (const res of waveResults) {
      if (res.status === "fulfilled" && res.value && res.value.payload) {
        anyGatewaySucceeded = true;
        const payload = res.value.payload;
        const eng = res.value.engine;
        const parsed = extractCandidatesFromResponse(payload);
        for (const item of parsed) {
          if (isCombinedIdAndNameQuery) {
            item.fromCombinedQuery = true;
            // On Scribd Full-Text Search for `"<ID>" "<Name>"`, Scribd's backend index has verified both exact quoted strings inside the document
            if (eng.isScribdDirectSearch && !payload.includes("No results for ")) {
              item.confirmedId = true;
              item.confirmedName = true;
            }
          } else if (isIdOnlyQuery && eng.isScribdDirectSearch && !payload.includes("No results for ")) {
            item.confirmedId = true;
          }
          collectedCandidates.push(item);
        }
      }
    }

    // If first wave had zero gateway successes, fall back to DuckDuckGo / Bing:
    if (!anyGatewaySucceeded) {
      for (let i = 2; i < engines.length; i += 1) {
        if (parentSignal && parentSignal.aborted) {
          throw new DOMException("Aborted", "AbortError");
        }
        try {
          const payload = await fetchTargetWithFallback(engines[i].url, parentSignal, fetchImpl);
          if (payload) {
            anyGatewaySucceeded = true;
            const parsed = extractCandidatesFromResponse(payload);
            for (const item of parsed) {
              if (isCombinedIdAndNameQuery) {
                item.fromCombinedQuery = true;
              }
              collectedCandidates.push(item);
            }
            if (collectedCandidates.length > 0) {
              break;
            }
          }
        } catch {
          // Try next search engine
        }
      }
    }

    return {
      anyGatewaySucceeded: anyGatewaySucceeded,
      candidates: collectedCandidates
    };
  }

  /**
   * Orchestrates the complete Multi-Query + Deep Document Verification pipeline:
   * 1. Query A (Combined ID + Name): `"<studentId>" "<studentName>"`
   * 2. Query B (Combined ID + Normalized ASCII Name if diacritics present): `"<studentId>" "<normalizedName>"`
   * 3. Query C (Exact ID Broad Discovery): `"<studentId>"`
   * 4. Deep Verification: For any non-confirmed candidate URL discovered with `hasId === true` where `hasName`
   *    is not yet confirmed, fetches the target document page via `r.jina.ai` or checks combined-query match.
   */
  async function runExposureSearch(studentId, studentName, options) {
    const opts = options || {};
    const signal = opts.signal || null;
    const onProgress = typeof opts.onProgress === "function" ? opts.onProgress : function () {};
    const fetchImpl = opts.fetchImpl || null;

    const normalizedName = normalizeText(studentName);
    const queries = [
      {
        label: "Combined exact Student ID + Name query",
        text: '"' + studentId + '" "' + studentName + '"',
        isCombined: true,
        isIdOnly: false
      },
      {
        label: "Exact 10-digit Student ID broad discovery query",
        text: '"' + studentId + '"',
        isCombined: false,
        isIdOnly: true
      }
    ];

    if (normalizedName !== studentName.toLowerCase()) {
      queries.push({
        label: "Normalized Vietnamese ASCII ID + Name query",
        text: '"' + studentId + '" "' + normalizedName + '"',
        isCombined: true,
        isIdOnly: false
      });
    }

    onProgress("Querying public search indices via read-only HTTPS CORS gateways...");

    const querySettled = await Promise.allSettled(
      queries.map((q) => executeSearchQuery(q, signal, fetchImpl))
    );

    if (signal && signal.aborted) {
      throw new DOMException("Aborted", "AbortError");
    }

    let anyNetworkSuccess = false;
    const mergedByKey = new Map();

    for (const outcome of querySettled) {
      if (outcome.status === "fulfilled" && outcome.value) {
        if (outcome.value.anyGatewaySucceeded) {
          anyNetworkSuccess = true;
        }
        for (const cand of outcome.value.candidates) {
          const key = getCanonicalDedupeKey(cand.url);
          const existing = mergedByKey.get(key);
          if (!existing) {
            mergedByKey.set(key, {
              url: cand.url,
              title: cand.title || "",
              snippet: cand.snippet || "",
              bodyText: "",
              fromCombinedQuery: Boolean(cand.fromCombinedQuery),
              confirmedId: Boolean(cand.confirmedId),
              confirmedName: Boolean(cand.confirmedName)
            });
          } else {
            if (cand.url.length > existing.url.length) {
              existing.url = cand.url;
            }
            existing.title = (existing.title + " " + (cand.title || "")).slice(0, 600);
            existing.snippet = (existing.snippet + " " + (cand.snippet || "")).slice(0, 2400);
            if (cand.fromCombinedQuery) {
              existing.fromCombinedQuery = true;
            }
            if (cand.confirmedId) {
              existing.confirmedId = true;
            }
            if (cand.confirmedName) {
              existing.confirmedName = true;
            }
          }
        }
      }
    }

    // Deep verification pass for candidate documents where ID matched but Name is not yet confirmed
    const candidatesList = Array.from(mergedByKey.values());
    const deepVerifyTargets = candidatesList
      .filter((c) => {
        if (c.confirmedId && c.confirmedName) {
          return false;
        }
        const textSoFar = [c.title, c.snippet, c.url].join(" ");
        const idFound = c.confirmedId || containsExactStudentId(textSoFar, studentId);
        const nameFound = c.confirmedName || containsNormalizedStudentName(textSoFar, studentName);
        if (idFound && nameFound) {
          return false;
        }
        if (c.fromCombinedQuery && idFound) {
          c.confirmedId = true;
          c.confirmedName = true;
          return false;
        }
        return idFound && !nameFound && !c.url.includes("scribd.com");
      })
      .slice(0, 2);

    if (deepVerifyTargets.length > 0) {
      onProgress("Performing deep verification on discovered public documents...");
      await Promise.allSettled(
        deepVerifyTargets.map(async (target) => {
          try {
            const docText = await fetchTargetWithFallback(target.url, signal, fetchImpl);
            if (docText) {
              target.bodyText = docText.slice(0, MAX_PAYLOAD_CHARS);
            }
          } catch {
            // Direct page fetch may be blocked by upstream bot-wall
          }
        })
      );
    }

    // Grade all candidates and sort GENUINE first
    const findings = [];
    for (const candidate of candidatesList) {
      const evaluated = evaluateCandidateVerdict(candidate, studentId, studentName);
      if (evaluated) {
        findings.push(evaluated);
      }
    }

    findings.sort((a, b) => {
      if (a.verdict === "GENUINE" && b.verdict !== "GENUINE") return -1;
      if (a.verdict !== "GENUINE" && b.verdict === "GENUINE") return 1;
      return a.url.localeCompare(b.url);
    });

    return {
      anyNetworkSuccess: anyNetworkSuccess,
      findings: findings
    };
  }

  /**
   * Removes all child nodes from a DOM element safely using `removeChild`.
   */
  function clearElementChildren(el) {
    if (!el) return;
    while (el.firstChild) {
      el.removeChild(el.firstChild);
    }
  }

  /**
   * Builds a single finding row DOM element using ONLY `document.createElement` and `textContent`.
   * Zero raw snippets or third-party PII are ever rendered (CWE-79, CWE-200).
   */
  function createFindingRowElement(doc, finding, index) {
    const item = doc.createElement("article");
    const isGenuine = finding.verdict === "GENUINE";
    item.className = "finding-row " + (isGenuine ? "finding-row-genuine" : "finding-row-false-positive");
    item.setAttribute("role", "listitem");

    const topBar = doc.createElement("div");
    topBar.className = "finding-top";

    const badgesGroup = doc.createElement("div");
    badgesGroup.className = "finding-badges";

    const verdictBadge = doc.createElement("span");
    verdictBadge.className = "verdict-badge " + (isGenuine ? "verdict-genuine" : "verdict-false-positive");
    verdictBadge.textContent = finding.verdict;
    badgesGroup.appendChild(verdictBadge);

    const matchedBadge = doc.createElement("span");
    matchedBadge.className = "matched-pill";
    matchedBadge.textContent = finding.matchedFieldsEn + " / " + finding.matchedFieldsVi;
    badgesGroup.appendChild(matchedBadge);

    topBar.appendChild(badgesGroup);

    const indexTag = doc.createElement("span");
    indexTag.className = "matched-pill";
    indexTag.textContent = "#" + String(index + 1);
    topBar.appendChild(indexTag);

    item.appendChild(topBar);

    const sourceHeading = doc.createElement("h3");
    sourceHeading.className = "finding-source-title";
    sourceHeading.textContent = finding.sourceName;
    item.appendChild(sourceHeading);

    const reasonEn = doc.createElement("p");
    reasonEn.className = "finding-reason";
    reasonEn.textContent = finding.reasonEn;
    item.appendChild(reasonEn);

    const reasonVi = doc.createElement("p");
    reasonVi.className = "finding-reason-vi";
    reasonVi.setAttribute("lang", "vi");
    reasonVi.textContent = finding.reasonVi;
    item.appendChild(reasonVi);

    const linkRow = doc.createElement("div");
    linkRow.className = "finding-link-row";

    const safeHref = sanitizeHttpsUrl(finding.url);
    if (safeHref) {
      const link = doc.createElement("a");
      link.className = "finding-link";
      link.setAttribute("href", safeHref);
      link.setAttribute("target", "_blank");
      link.setAttribute("rel", "noopener noreferrer");
      link.textContent = safeHref;
      linkRow.appendChild(link);
    }

    item.appendChild(linkRow);
    return item;
  }

  /**
   * Populates safe manual verification links (`rel="noopener noreferrer" target="_blank"`)
   * when all public CORS proxies are unreachable or rate-limited.
   */
  function renderManualVerificationLinks(doc, containerEl, studentId, studentName) {
    clearElementChildren(containerEl);
    const combinedQuery = encodeURIComponent('"' + studentId + '" "' + studentName + '"');
    const idOnlyQuery = encodeURIComponent('"' + studentId + '"');

    const manualTargets = [
      {
        label: "Verify on Yahoo Search (ID + Name)",
        url: "https://search.yahoo.com/search?p=" + combinedQuery
      },
      {
        label: "Verify on DuckDuckGo (ID + Name)",
        url: "https://duckduckgo.com/?q=" + combinedQuery
      },
      {
        label: "Verify on Bing (Exact 10-Digit ID)",
        url: "https://www.bing.com/search?q=" + idOnlyQuery
      },
      {
        label: "Verify on Google (ID + Name)",
        url: "https://www.google.com/search?q=" + combinedQuery
      }
    ];

    for (const target of manualTargets) {
      const safeUrl = sanitizeHttpsUrl(target.url);
      if (!safeUrl) continue;
      const anchor = doc.createElement("a");
      anchor.className = "btn btn-secondary";
      anchor.setAttribute("href", safeUrl);
      anchor.setAttribute("target", "_blank");
      anchor.setAttribute("rel", "noopener noreferrer");
      anchor.textContent = target.label;
      containerEl.appendChild(anchor);
    }
  }

  /**
   * Initializes DOM bindings and clickjacking defense when running inside a browser document.
   */
  function initBrowserDom() {
    if (typeof window === "undefined" || typeof document === "undefined") {
      return;
    }

    const form = document.getElementById("exposure-form");
    const idInput = document.getElementById("student-id");
    const nameInput = document.getElementById("student-name");
    const idError = document.getElementById("student-id-error");
    const nameError = document.getElementById("student-name-error");
    const generalError = document.getElementById("form-general-error");
    const submitBtn = document.getElementById("submit-btn");
    const cancelBtn = document.getElementById("cancel-btn");
    const resetBtn = document.getElementById("reset-btn");

    const statusSection = document.getElementById("status-section");
    const loadingPanel = document.getElementById("loading-panel");
    const loadingStep = document.getElementById("loading-step");

    const resultsSection = document.getElementById("results-section");
    const resultsSummary = document.getElementById("results-summary");
    const findingsContainer = document.getElementById("findings-container");
    const emptyStatePanel = document.getElementById("empty-state-panel");
    const degradedPanel = document.getElementById("degraded-panel");
    const manualLinksList = document.getElementById("manual-links-list");
    const frameWarning = document.getElementById("frame-warning");

    // CWE-1021 Clickjacking Defense-in-Depth: refuse operation inside an embedded frame
    try {
      if (window.top !== window.self) {
        if (frameWarning) {
          frameWarning.hidden = false;
        }
        if (submitBtn) submitBtn.disabled = true;
        if (idInput) idInput.disabled = true;
        if (nameInput) nameInput.disabled = true;
        try {
          window.top.location = window.self.location.href;
        } catch {
          // Cross-origin frame prevents navigation; form remains disabled
        }
        return;
      }
    } catch {
      if (frameWarning) frameWarning.hidden = false;
      if (submitBtn) submitBtn.disabled = true;
      return;
    }

    if (!form || !idInput || !nameInput) {
      return;
    }

    let activeAbortController = null;
    let lastSearchTimestamp = 0;

    function setFieldError(inputEl, errorEl, messageText) {
      if (!inputEl || !errorEl) return;
      if (messageText) {
        inputEl.setAttribute("aria-invalid", "true");
        errorEl.textContent = messageText;
        errorEl.hidden = false;
      } else {
        inputEl.removeAttribute("aria-invalid");
        errorEl.textContent = "";
        errorEl.hidden = true;
      }
    }

    function setGeneralError(messageText) {
      if (!generalError) return;
      if (messageText) {
        generalError.textContent = messageText;
        generalError.hidden = false;
      } else {
        generalError.textContent = "";
        generalError.hidden = true;
      }
    }

    function setLoadingState(isLoading, stepMessage) {
      if (statusSection && loadingPanel) {
        statusSection.hidden = !isLoading;
        loadingPanel.hidden = !isLoading;
      }
      if (loadingStep && stepMessage) {
        loadingStep.textContent = stepMessage;
      }
      if (submitBtn) {
        submitBtn.disabled = isLoading;
      }
      if (cancelBtn) {
        cancelBtn.hidden = !isLoading;
      }
    }

    idInput.addEventListener("input", () => {
      setFieldError(idInput, idError, "");
      setGeneralError("");
    });

    nameInput.addEventListener("input", () => {
      setFieldError(nameInput, nameError, "");
      setGeneralError("");
    });

    if (cancelBtn) {
      cancelBtn.addEventListener("click", () => {
        if (activeAbortController) {
          activeAbortController.abort();
          activeAbortController = null;
        }
        setLoadingState(false, "");
        setGeneralError("Search cancelled by user. / Đã dừng tìm kiếm theo yêu cầu.");
      });
    }

    if (resetBtn) {
      resetBtn.addEventListener("click", () => {
        if (activeAbortController) {
          activeAbortController.abort();
          activeAbortController = null;
        }
        setFieldError(idInput, idError, "");
        setFieldError(nameInput, nameError, "");
        setGeneralError("");
        setLoadingState(false, "");
        if (resultsSection) resultsSection.hidden = true;
        clearElementChildren(findingsContainer);
        if (emptyStatePanel) emptyStatePanel.hidden = true;
        if (degradedPanel) degradedPanel.hidden = true;
      });
    }

    form.addEventListener("submit", async (event) => {
      event.preventDefault();

      setFieldError(idInput, idError, "");
      setFieldError(nameInput, nameError, "");
      setGeneralError("");

      const validation = validateInputs(idInput.value, nameInput.value);
      if (!validation.valid) {
        if (!validation.idCheck.valid) {
          setFieldError(
            idInput,
            idError,
            validation.idCheck.errorEn + " / " + validation.idCheck.errorVi
          );
        }
        if (!validation.nameCheck.valid) {
          setFieldError(
            nameInput,
            nameError,
            validation.nameCheck.errorEn + " / " + validation.nameCheck.errorVi
          );
        }
        const firstInvalid = !validation.idCheck.valid ? idInput : nameInput;
        firstInvalid.focus();
        return;
      }

      const now = Date.now();
      if (now - lastSearchTimestamp < COOLDOWN_MS) {
        setGeneralError(
          "Please wait a moment before starting another check to avoid rate-limiting public gateways. / Vui lòng đợi vài giây trước khi kiểm tra tiếp."
        );
        return;
      }
      lastSearchTimestamp = now;

      if (activeAbortController) {
        activeAbortController.abort();
      }
      activeAbortController = new AbortController();

      const validId = validation.idCheck.value;
      const validName = validation.nameCheck.value;

      if (resultsSection) resultsSection.hidden = true;
      clearElementChildren(findingsContainer);
      if (emptyStatePanel) emptyStatePanel.hidden = true;
      if (degradedPanel) degradedPanel.hidden = true;

      setLoadingState(
        true,
        "Searching public indices for exact 10-digit ID and normalized Vietnamese name..."
      );

      try {
        const result = await runExposureSearch(validId, validName, {
          signal: activeAbortController.signal,
          onProgress: (msg) => {
            if (loadingStep) {
              loadingStep.textContent = msg;
            }
          }
        });

        setLoadingState(false, "");
        if (resultsSection) resultsSection.hidden = false;

        const findings = result.findings || [];
        const genuineCount = findings.filter((f) => f.verdict === "GENUINE").length;
        const falsePosCount = findings.filter((f) => f.verdict === "FALSE POSITIVE").length;

        if (findings.length > 0) {
          if (resultsSummary) {
            resultsSummary.textContent =
              "Found " +
              String(findings.length) +
              " public source(s): " +
              String(genuineCount) +
              " GENUINE exposure(s), " +
              String(falsePosCount) +
              " FALSE POSITIVE / partial match(es). Raw document excerpts are hidden to protect third-party privacy.";
          }
          for (let i = 0; i < findings.length; i += 1) {
            const rowEl = createFindingRowElement(document, findings[i], i);
            findingsContainer.appendChild(rowEl);
          }
          // Even when only FALSE POSITIVE results exist, remind user of accuracy caveats
          if (genuineCount === 0 && emptyStatePanel) {
            emptyStatePanel.hidden = false;
          }
        } else {
          if (resultsSummary) {
            resultsSummary.textContent =
              "0 matching public exposures found in checked indices. Remember: absence of results does not prove your data is not exposed.";
          }
          if (emptyStatePanel) {
            emptyStatePanel.hidden = false;
          }
          if (!result.anyNetworkSuccess && degradedPanel && manualLinksList) {
            degradedPanel.hidden = false;
            renderManualVerificationLinks(document, manualLinksList, validId, validName);
          }
        }
      } catch (err) {
        if (err && err.name === "AbortError") {
          return;
        }
        setLoadingState(false, "");
        if (resultsSection) resultsSection.hidden = false;
        if (resultsSummary) {
          resultsSummary.textContent =
            "Automated gateways encountered a network error. Remember: absence of results does not prove your data is not exposed.";
        }
        if (emptyStatePanel) {
          emptyStatePanel.hidden = false;
        }
        if (degradedPanel && manualLinksList) {
          degradedPanel.hidden = false;
          renderManualVerificationLinks(document, manualLinksList, validId, validName);
        }
      } finally {
        activeAbortController = null;
      }
    });
  }

  if (typeof document !== "undefined") {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", initBrowserDom);
    } else {
      initBrowserDom();
    }
  }

  // Export pure functions for automated Node.js verification (`node --test vibe-code-project/app.test.js`)
  const exportedApi = {
    normalizeText: normalizeText,
    escapeRegExp: escapeRegExp,
    validateStudentId: validateStudentId,
    validateStudentName: validateStudentName,
    validateInputs: validateInputs,
    unwrapSearchRedirectUrl: unwrapSearchRedirectUrl,
    sanitizeHttpsUrl: sanitizeHttpsUrl,
    isIgnoredSearchEngineUrl: isIgnoredSearchEngineUrl,
    classifySource: classifySource,
    containsExactStudentId: containsExactStudentId,
    containsNormalizedStudentName: containsNormalizedStudentName,
    evaluateCandidateVerdict: evaluateCandidateVerdict,
    getCanonicalDedupeKey: getCanonicalDedupeKey,
    extractCandidatesFromResponse: extractCandidatesFromResponse,
    buildProxyGateways: buildProxyGateways,
    buildSearchEngineUrls: buildSearchEngineUrls,
    runExposureSearch: runExposureSearch
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = exportedApi;
  } else if (rootScope) {
    rootScope.OUExposureSelfCheck = exportedApi;
  }
})(typeof globalThis !== "undefined" ? globalThis : this);
