// Public OU sub-websites used as graph nodes.
// Every entry was fetched once, without credentials, and only where robots.txt
// allowed it. `tcnh.ou.edu.vn` is deliberately absent: its robots.txt is
// "User-agent: * / Disallow: /". See README.md for the full exclusion list.
//
// cat: faculty | support | service | publication | campus

export const ROOT = {
  id: "root",
  host: "ou.edu.vn",
  url: "https://ou.edu.vn/",
  label: "Ho Chi Minh City Open University",
  short: "ou.edu.vn",
  cat: "root",
};

export const NODES = [
  // --- Faculties and academic units -------------------------------------
  {
    id: "it",
    host: "it.ou.edu.vn",
    display: "IT",
    url: "https://it.ou.edu.vn/",
    label: "Faculty of Information Technology",
    short: "it.ou.edu.vn",
    cat: "faculty",
  },
  {
    id: "kqtkd",
    host: "kqtkd.ou.edu.vn",
    display: "Business",
    url: "https://kqtkd.ou.edu.vn/",
    label: "Faculty of Business Administration",
    short: "kqtkd.ou.edu.vn",
    cat: "faculty",
  },
  {
    id: "faa",
    host: "faa.ou.edu.vn",
    display: "Accounting",
    url: "https://faa.ou.edu.vn/",
    label: "Faculty of Accounting – Auditing",
    short: "faa.ou.edu.vn",
    cat: "faculty",
  },
  {
    id: "khoann",
    host: "khoann.ou.edu.vn",
    display: "Languages",
    url: "https://khoann.ou.edu.vn/",
    label: "Faculty of Foreign Languages",
    short: "khoann.ou.edu.vn",
    cat: "faculty",
  },
  {
    id: "xhh",
    host: "xhh.ou.edu.vn",
    display: "Social Sci.",
    url: "https://xhh.ou.edu.vn/",
    label: "Faculty of Social Sciences",
    short: "xhh.ou.edu.vn",
    cat: "faculty",
  },
  {
    id: "biotech",
    host: "biotech.ou.edu.vn",
    display: "Biotech",
    url: "https://biotech.ou.edu.vn/",
    label: "Faculty of Biotechnology",
    short: "biotech.ou.edu.vn",
    cat: "faculty",
  },
  {
    id: "ce",
    host: "ce.ou.edu.vn",
    display: "Construction",
    url: "http://ce.ou.edu.vn/",
    label: "Faculty of Construction",
    short: "ce.ou.edu.vn",
    cat: "faculty",
    httpOnly: true,
  },
  {
    id: "dtdb",
    host: "dtdb.ou.edu.vn",
    display: "Special Training",
    url: "https://dtdb.ou.edu.vn/",
    label: "Faculty of Special Training",
    short: "dtdb.ou.edu.vn",
    cat: "faculty",
  },
  {
    id: "sdh",
    host: "sdh.ou.edu.vn",
    display: "Graduate",
    url: "https://sdh.ou.edu.vn/",
    label: "Graduate School",
    short: "sdh.ou.edu.vn",
    cat: "faculty",
  },
  {
    id: "fs",
    host: "fs.ou.edu.vn",
    display: "Basic Sciences",
    url: "https://fs.ou.edu.vn/",
    label: "Faculty of Basic Sciences",
    short: "fs.ou.edu.vn",
    cat: "faculty",
  },

  // --- Academic services and support offices ----------------------------
  {
    id: "tuyensinh",
    host: "tuyensinh.ou.edu.vn",
    display: "Admissions",
    url: "https://tuyensinh.ou.edu.vn/",
    label: "Admissions Portal",
    short: "tuyensinh.ou.edu.vn",
    cat: "service",
  },
  {
    id: "quanlydaotao",
    host: "quanlydaotao.ou.edu.vn",
    display: "Acad. Affairs",
    url: "https://quanlydaotao.ou.edu.vn/",
    label: "Office of Academic Affairs",
    short: "quanlydaotao.ou.edu.vn",
    cat: "support",
  },
  {
    id: "bdcl",
    host: "bdcl.ou.edu.vn",
    display: "Quality Assur.",
    url: "https://bdcl.ou.edu.vn/",
    label: "Quality Assurance Office",
    short: "bdcl.ou.edu.vn",
    cat: "support",
  },
  {
    id: "ttpc",
    host: "ttpc.ou.edu.vn",
    display: "Legal",
    url: "https://ttpc.ou.edu.vn/",
    label: "Legal & Internal Audit Office",
    short: "ttpc.ou.edu.vn",
    cat: "support",
  },
  {
    id: "ttqlhttt",
    host: "ttqlhttt.ou.edu.vn",
    display: "IT Systems",
    url: "https://ttqlhttt.ou.edu.vn/",
    label: "IT Systems Management Centre",
    short: "ttqlhttt.ou.edu.vn",
    cat: "support",
  },
  {
    id: "mou",
    host: "mou.ou.edu.vn",
    display: "Intl. Co-op",
    url: "https://mou.ou.edu.vn/",
    label: "International Co-operation (MOU)",
    short: "mou.ou.edu.vn",
    cat: "support",
  },
  {
    id: "csc",
    host: "csc.ou.edu.vn",
    display: "Lang. & IT",
    url: "https://csc.ou.edu.vn/",
    label: "Foreign Language & IT Centre",
    short: "csc.ou.edu.vn",
    cat: "service",
  },
  {
    id: "tuyendung",
    host: "tuyendung.ou.edu.vn",
    display: "Recruitment",
    url: "https://tuyendung.ou.edu.vn/",
    label: "Recruitment Portal",
    short: "tuyendung.ou.edu.vn",
    cat: "service",
  },
  {
    id: "vieclam",
    host: "vieclam.ou.edu.vn",
    display: "Careers",
    url: "https://vieclam.ou.edu.vn/",
    label: "Career & Job Centre",
    short: "vieclam.ou.edu.vn",
    cat: "service",
  },
  {
    id: "congdoan",
    host: "congdoan.ou.edu.vn",
    display: "Trade Union",
    url: "http://congdoan.ou.edu.vn/",
    label: "Trade Union",
    short: "congdoan.ou.edu.vn",
    cat: "support",
    httpOnly: true,
  },
  {
    id: "dtn",
    host: "dtn.ou.edu.vn",
    display: "Youth Union",
    url: "http://dtn.ou.edu.vn/",
    label: "Youth Union Office",
    short: "dtn.ou.edu.vn",
    cat: "support",
    httpOnly: true,
  },

  // --- Publications and conferences -------------------------------------
  {
    id: "journalofscience",
    host: "journalofscience.ou.edu.vn",
    display: "J. of Science",
    url: "https://journalofscience.ou.edu.vn/",
    label: "Journal of Science",
    short: "journalofscience.ou.edu.vn",
    cat: "publication",
  },
  {
    id: "eidt",
    host: "eidt.ou.edu.vn",
    display: "EIDT",
    url: "https://eidt.ou.edu.vn/",
    label: "EIDT Conference",
    short: "eidt.ou.edu.vn",
    cat: "publication",
  },
  {
    id: "icaefm",
    host: "icaefm.ou.edu.vn",
    display: "ICAEFM",
    url: "https://icaefm.ou.edu.vn/",
    label: "ICAEFM Conference",
    short: "icaefm.ou.edu.vn",
    cat: "publication",
  },

  // --- International / campus experience --------------------------------
  {
    id: "en",
    host: "en.ou.edu.vn",
    display: "English Site",
    url: "https://en.ou.edu.vn/",
    label: "English-language Site",
    short: "en.ou.edu.vn",
    cat: "service",
  },
  {
    id: "vr",
    host: "vr.ou.edu.vn",
    display: "VR Tour",
    url: "https://vr.ou.edu.vn/",
    label: "360° Virtual Campus Tour",
    short: "vr.ou.edu.vn",
    cat: "campus",
  },
];

export const CATEGORIES = [
  { id: "faculty", label: "Faculties", color: "#4ade80" },
  { id: "service", label: "Services", color: "#60a5fa" },
  { id: "support", label: "Support offices", color: "#f0abfc" },
  { id: "publication", label: "Publications", color: "#fbbf24" },
  { id: "campus", label: "Campus experience", color: "#f87171" },
];

export const ALL = [ROOT, ...NODES];

export const LINKS = ALL.filter((n) => n.id !== "root").map((n) => ({
  source: "root",
  target: n.id,
}));

/** Hosts discovered during research but deliberately left out. */
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

export const CATEGORY_COLOR = Object.fromEntries(
  CATEGORIES.map((c) => [c.id, c.color]),
);
CATEGORY_COLOR.root = "#e2e8f0";
