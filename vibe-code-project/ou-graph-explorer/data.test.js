import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import {
  ALL,
  NODES,
  LINKS,
  ROOT,
  CATEGORIES,
  CATEGORY_COLOR,
} from "./data.js";
import { EXCLUDED } from "./exclusions.js";

const here = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(join(here, "index.html"), "utf8");

test("every node has the fields the UI needs", () => {
  for (const n of ALL) {
    assert.ok(n.id, "id missing");
    assert.ok(n.host, `${n.id}: host missing`);
    assert.ok(n.label, `${n.id}: label missing`);
    assert.ok(n.short, `${n.id}: short missing`);
    assert.ok(CATEGORY_COLOR[n.cat], `${n.id}: unknown category ${n.cat}`);
    assert.ok(n.url.startsWith("http://") || n.url.startsWith("https://"), `${n.id}: bad url`);
  }
});

test("ids are unique and hosts are unique", () => {
  assert.equal(new Set(ALL.map((n) => n.id)).size, ALL.length);
  assert.equal(new Set(ALL.map((n) => n.host)).size, ALL.length);
});

test("the graph is a single-level star rooted at ou.edu.vn", () => {
  assert.equal(LINKS.length, NODES.length);
  for (const l of LINKS) assert.equal(l.source, ROOT.id);
  assert.equal(ROOT.host, "ou.edu.vn");
  assert.equal(ROOT.url, "https://ou.edu.vn/");
});

test("every link target exists as a node", () => {
  const ids = new Set(ALL.map((n) => n.id));
  for (const l of LINKS) assert.ok(ids.has(l.target), `dangling link ${l.target}`);
});

test("every node belongs to a declared category", () => {
  const declared = new Set(CATEGORIES.map((c) => c.id));
  for (const n of NODES) assert.ok(declared.has(n.cat), `${n.id}: ${n.cat}`);
});

test("no node points at a host known to be restricted or broken", () => {
  const banned = new Set(EXCLUDED.map((e) => e.host));
  for (const n of ALL) {
    assert.ok(!banned.has(n.host), `${n.host} is on the exclusion list`);
  }
});

test("tcnh.ou.edu.vn is excluded because its robots.txt forbids all crawling", () => {
  assert.ok(
    EXCLUDED.some((e) => e.host === "tcnh.ou.edu.vn" && /Disallow: \//.test(e.reason)),
  );
  assert.ok(!ALL.some((n) => n.host === "tcnh.ou.edu.vn"));
});

test("sites that only serve plain HTTP are flagged, the rest are HTTPS", () => {
  for (const n of ALL) {
    if (n.url.startsWith("http://")) {
      assert.equal(n.httpOnly, true, `${n.id} uses http:// without httpOnly flag`);
    } else {
      assert.notEqual(n.httpOnly, true, `${n.id} flagged httpOnly but uses https`);
    }
  }
});

test("the static HTML directory matches data.js exactly", () => {
  const inHtml = [...html.matchAll(/<li data-node-id="([^"]+)">/g)].map((m) => m[1]);
  const expected = NODES.map((n) => n.id).sort();
  assert.deepEqual(inHtml.slice().sort(), expected);
});

test("every external link in the HTML uses rel=noopener noreferrer", () => {
  const anchors = [...html.matchAll(/<a\b[^>]*href="(https?:\/\/[^"]+)"[^>]*>/g)];
  assert.ok(anchors.length > 0, "no external links found");
  for (const [tag, href] of anchors) {
    assert.match(tag, /target="_blank"/, `${href} missing target=_blank`);
    assert.match(tag, /rel="noopener noreferrer"/, `${href} missing rel`);
  }
});

test("the directory links the same URLs as the data", () => {
  const hrefs = new Set([...html.matchAll(/href="(https?:\/\/[^"]+)"/g)].map((m) => m[1]));
  for (const n of NODES) assert.ok(hrefs.has(n.url), `${n.url} missing from HTML`);
});

test("the page declares a strict Content-Security-Policy", () => {
  const m = html.match(
    /http-equiv="Content-Security-Policy"\s*\n?\s*content="([^"]+)"/,
  );
  assert.ok(m, "CSP meta tag missing");
  const csp = m[1];
  assert.match(csp, /default-src 'none'/);
  assert.match(csp, /object-src 'none'/);
  assert.match(csp, /base-uri 'none'/);
  assert.match(csp, /form-action 'none'/);
  assert.doesNotMatch(csp, /unsafe-inline/, "CSP must not allow unsafe-inline");
  assert.doesNotMatch(csp, /unsafe-eval/, "CSP must not allow unsafe-eval");
  assert.doesNotMatch(csp, /(^|;)\s*\*\s*(;|$)/, "CSP must not use a wildcard source");
});

test("the page loads no third-party resources", () => {
  // Resources the page *fetches*. Outbound <a href> links are allowed to point
  // at ou.edu.vn; anything else is a leak or a tracker.
  const fetched = [...html.matchAll(/<(?:script|link|img|iframe)\b[^>]*\b(?:src|href)="([^"]+)"/g)].map(
    (m) => m[1],
  );
  for (const s of fetched) {
    assert.doesNotMatch(s, /^https?:\/\//, `remote resource ${s} would be fetched`);
  }
  const anchorHosts = new Set(
    [...html.matchAll(/<a\b[^>]*href="https?:\/\/([^/"]+)/g)].map((m) => m[1]),
  );
  for (const h of anchorHosts) {
    assert.match(h, /(^|\.)ou\.edu\.vn$/, `${h} is not an ou.edu.vn link`);
  }
  assert.doesNotMatch(html, /googleapis|googletagmanager|google-analytics|gtag\(|facebook\.net|hotjar/i);
  assert.doesNotMatch(html, /<script[^>]*src="(?!app\.js)/);
});

test("no inline scripts or inline event handlers", () => {
  assert.doesNotMatch(html, /<script(?![^>]*\bsrc=)[^>]*>[\s\S]*?\S[\s\S]*?<\/script>/);
  assert.doesNotMatch(html, /\son(?:click|load|error|mouseover)\s*=/i);
});

test("the legal notice states independence and no data collection", () => {
  assert.match(html, /Independent project/i);
  assert.match(html, /not\s+affiliated/i);
  assert.match(html, /no personal data/i);
  assert.match(html, /belong to their\s+respective owners/i);
});

/**
 * The exclusion notes list internal portals by name. They belong in tests, not
 * in the bundle: serving them would publish an inventory of systems the page
 * otherwise never mentions. This guards against re-importing them into a
 * shipped file.
 */
test("the shipped bundle does not publish the exclusion list", () => {
  const shipped = ["data.js", "app.js", "layout.js", "index.html", "style.css"];
  for (const file of shipped) {
    const text = readFileSync(join(here, "..", "ou-graph-explorer", file), "utf8");
    // Anchor on the internal-only hosts rather than the word EXCLUDED.
    for (const host of ["sis.ou.edu.vn", "fsis.ou.edu.vn", "htqlkh.ou.edu.vn", "tienichsv.ou.edu.vn"]) {
      assert.ok(!text.includes(host), `${file} must not name the internal host ${host}`);
    }
  }
});
