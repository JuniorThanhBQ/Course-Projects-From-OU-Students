// Research notes, imported by the test suite only. Deliberately not part of
// the browser bundle: this enumerates internal portals, and shipping it would
// publish an inventory of systems that the page otherwise never mentions.

export const EXCLUDED = [
  { host: "tcnh.ou.edu.vn", reason: "robots.txt declares Disallow: /" },
  { host: "sis.ou.edu.vn", reason: "Student login portal" },
  { host: "learn.ou.edu.vn", reason: "LMS, account required" },
  { host: "fsis.ou.edu.vn", reason: "Staff portal, SSO login" },
  { host: "cvht.ou.edu.vn", reason: "Advisor site, login required" },
  { host: "thuvien.ou.edu.vn", reason: "Library catalogue, login required" },
  { host: "tienichsv.ou.edu.vn", reason: "Student utilities, login required" },
  { host: "tienichsdh.ou.edu.vn", reason: "Graduate utilities, login required" },
  { host: "htqlkh.ou.edu.vn", reason: "Research-management system, no TLS" },
  { host: "dichvu.ou.edu.vn", reason: "Blank IIS default page, no content" },
  { host: "alumni.ou.edu.vn", reason: "Expired TLS certificate" },
  { host: "cpa.ou.edu.vn", reason: "Expired TLS certificate" },
  { host: "khoaluat.ou.edu.vn", reason: "Expired TLS certificate" },
  { host: "ktqlc.ou.edu.vn", reason: "Expired TLS certificate" },
  { host: "vi2.ou.edu.vn", reason: "Expired TLS certificate" },
  { host: "icetoe.ou.edu.vn", reason: "Incomplete TLS chain" },
  { host: "nhatro.ou.edu.vn", reason: "HTTP 500 on both schemes" },
];
