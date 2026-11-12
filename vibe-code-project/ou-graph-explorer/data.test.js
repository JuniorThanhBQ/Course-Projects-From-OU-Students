
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
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

/**
 * Exclusion notes are deliberately not stored anywhere in this repository.
 * GitHub Pages serves every file in a public repo, so a notes file, or a table
 * inside a committed test, is just as downloadable as the page itself. The
 * reasoning for what was left out belongs in the commit message and the pull
 * request, where it is reviewable without publishing a host inventory.
 */
test("nodes only point at hosts that were verified as public and crawlable", () => {
  assert.ok(ALL.length > 1, "expected the graph to contain sub-sites");
  for (const n of ALL) {
    assert.ok(/^https?:\/\/(?:[a-z0-9-]+\.)?ou\.edu\.vn\/$/.test(n.url), `${n.id}: unexpected URL shape`);
  }
  const hosts = ALL.map((n) => n.host);
  assert.equal(new Set(hosts).size, hosts.length, "duplicate host in the node list");
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
 * Every hostname that appears in a page-facing file must be one of the hosts
 * the graph actually links. This catches a stray note, a stray comment, or a
 * reintroduced inventory without this file having to name any of the excluded
 * hosts -- doing that here would be the same disclosure in a different file.
 */
test("page-facing files mention no host outside the published node list", () => {
  const published = new Set(ALL.map((n) => n.host));
  const pageFiles = ["data.js", "app.js", "layout.js", "index.html", "style.css", "README.md"];
  for (const file of pageFiles) {
    const text = readFileSync(join(here, "..", "ou-graph-explorer", file), "utf8");
    for (const [host] of text.matchAll(/[a-z0-9-]+(?:\.[a-z0-9-]+)*\.ou\.edu\.vn/gi)) {
      assert.ok(published.has(host), `${file} mentions ${host}, which is not a published node`);
    }
  }
  for (const notes of ["exclusions.js", "EXCLUDED.md"]) {
    assert.ok(
      !existsSync(join(here, "..", "ou-graph-explorer", notes)),
      `exclusion notes must not be committed (${notes} would be downloadable from Pages)`,
    );
  }
});
