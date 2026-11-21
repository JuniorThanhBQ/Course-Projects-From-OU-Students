## Directory Index — Projects in `vibe-code-project/`

| Project | Folder / Entry Point | Description | Test Command |
|---|---|---|---|
| **1. OU Student ID & Name Exposure Self-Check Tool** | [`./ou-student-id-leak-checker/`](./ou-student-id-leak-checker/) ([`index.html`](./ou-student-id-leak-checker/index.html), [`disclaimer.html`](./ou-student-id-leak-checker/disclaimer.html), [`README.md`](./ou-student-id-leak-checker/README.md)) | Privacy-first client-side tool for OU students to check if their 10-digit Student ID and name are exposed in public web indices or document repositories (Scribd, `*.ou.edu.vn`, Studocu, SlideShare, 123doc, public PDFs). Zero cookies, zero `localStorage`, zero `sessionStorage`. | `npm --prefix vibe-code-project/ou-student-id-leak-checker test` |
| **2. HCMC OU Campus Route Planner (A* & Contraction Hierarchies)** | [`./hcmc-ou-a-search/`](./hcmc-ou-a-search/) ([`./hcmc-ou-a-search/README.md`](./hcmc-ou-a-search/README.md)) | Interactive HCMC road-network shortest-path visualizer comparing Dijkstra, A*, Bidirectional A* (ALT Landmarks), and Contraction Hierarchies across HCMOU campuses. Operates independently (stores only a non-sensitive UI theme key `"ou-theme"` in `localStorage`). | `npm --prefix vibe-code-project/hcmc-ou-a-search test` |

---

## Một vài lưu ý khi thực hiện các dự án theo phong cách "vibe coding"

1. **Các mô hình ngôn ngữ lớn (LLM) hiện nay cực kỳ thông minh.** Chúng có thể hiểu và giải quyết cả những bài toán thuật toán phức tạp trong thời gian rất ngắn. **TUY NHIÊN**, điều gì sẽ xảy ra nếu LLM mắc lỗi hoặc đưa ra giải pháp tiêu tốn quá nhiều tài nguyên tính toán? Chúng ta cần phải có khả năng nhận diện được những vấn đề này. Và để làm được điều đó, bản thân chúng ta vẫn cần phải hiểu và học về thuật toán.

2. Nhiều người có thể nói: **"Nếu LLM sai, cứ bảo nó sửa lại code là được."** Nhưng vấn đề thực sự nằm ở chỗ: làm sao bạn có thể yêu cầu nó sửa lỗi khi chính bạn còn không biết lỗi đó nằm ở đâu? Thú thật là, ngay cả bản thân tôi đôi khi cũng gặp khó khăn với vấn đề này.

3. Nếu có thể, tôi đặc biệt khuyên các bạn sinh viên **từ khóa K24 trở đi** nên dành nhiều thời gian hơn để học về **Kiến trúc phần mềm (Software Architecture), Lập kế hoạch cấp cao (High-Level Planning) và Kỹ năng giải quyết vấn đề** thông qua các nền tảng như LeetCode.

> [!NOTE]
>
> Ngoài ra, **đừng ngại sử dụng các công cụ AI!** Nhưng đồng thời, cũng đừng tin tưởng chúng một cách mù quáng (100%), trừ khi bạn chỉ đang xây dựng thứ gì đó cho vui, hoặc ngay từ đầu đã xác định dự án của mình thuần túy là "vibe coding" (lập trình theo cảm hứng).

4. **Lời cuối:** Mọi người hãy cố gắng hết sức nhé! Ngành CNTT có thể sẽ phải đối mặt với những thách thức lớn trong vài năm tới. :v

> [!IMPORTANT]
>
> AI đang tiến hóa với tốc độ chóng mặt, trong khi chúng ta vẫn chưa tìm ra phương pháp thực sự hiệu quả để học tập và thích nghi với tất cả những thay đổi này.

**Vì vậy, hãy tiếp tục học hỏi, tiếp tục luyện tập và đừng bỏ cuộc nhé!**

P/S: Nói chứ, mình cảm thấy ngành CNTT giờ cũng mông lung lắm luôn ý.

---

## Some Things to Keep in Mind When Working on Vibe Coding Projects

1. **Today's LLMs are incredibly smart.** They can understand and solve even complex algorithmic problems in a very short time. **HOWEVER**, what happens if an LLM makes a mistake or produces a solution with extremely high computational costs? We need to be able to recognize these problems. And to do that, we still need to understand and learn algorithms ourselves.

2. Many people might say, **"If the LLM makes a mistake, just ask it to fix the code."** But here's the real problem: how can you ask it to fix something when you don't even know what's wrong in the first place? To be fair, this is something I still struggle with myself.

3. If possible, I strongly recommend that students from **K24 onwards** invest more time in learning **Software Architecture, High-Level Planning, and Problem-Solving Skills** through platforms like LeetCode.

> [!NOTE]
>
> Also, **don't be afraid to use AI tools!** But at the same time, don't blindly trust them 100%, unless you're building something just for fun or you've already decided that your project is purely for vibe coding from the beginning.

4. **Final thoughts:** Keep doing your best, everyone! The IT industry might face some serious challenges in the next few years. :v

> [!IMPORTANT] 
>
> AI is advancing incredibly fast, while we still haven't figured out a truly effective way to learn and adapt to all these changes.

**So, keep learning, keep practicing, and don't give up!**

---

## OU Student ID & Name Exposure Self-Check Tool ("Are your student ID and name exposed anywhere?")

The privacy-first, client-side exposure self-check web tool for Ho Chi Minh City Open University (OU) students lives in [`vibe-code-project/ou-student-id-leak-checker/`](./ou-student-id-leak-checker/) (sibling to [`vibe-code-project/hcmc-ou-a-search/`](./hcmc-ou-a-search/)).

### Key Features & Security Highlights
- **Self-Check Privacy-by-Design (`CWE-200`):** The OU Student ID & Name Exposure Self-Check Tool (`vibe-code-project/ou-student-id-leak-checker/index.html`, `app.js`, `disclaimer.html`, `404.html`) runs 100% in the browser on static GitHub Pages with zero backend database, zero cookies, zero `localStorage`, zero `sessionStorage`, and zero server logging (note: sibling sub-folder projects such as `vibe-code-project/hcmc-ou-a-search/` operate independently and store only a non-sensitive `"ou-theme"` preference). Raw text excerpts from source documents are never rendered so third-party student PII is never re-exposed.
- **Parallel Multi-Track Discovery (Scribd + General Web & `*.ou.edu.vn`):** Queries Track 1 (non-overlapping regional Scribd mirrors with `10,000 ms` timeout) and Track 2 (Yahoo Web Search indexing `*.ou.edu.vn`, `studocu.com`, `slideshare.net`, `123docz.net`, and public PDFs/spreadsheets with `15,000 ms` timeout) concurrently with progressive UI rendering and query-echo stripping.
- **Vietnamese Diacritic Normalization:** Automatically normalizes Vietnamese diacritics (`NFC` / `NFD`, including decomposed combining marks `\p{M}`) and converts `đ/Đ → d` case-insensitively while validating the exact 10-digit Student ID (`^\d{10}$`, with automatic full-width digit normalization).
- **Deterministic Evidence-Based Verdicts (`GENUINE` vs. `FALSE POSITIVE`):** Distinguishes confirmed combined ID + Name exposures (`GENUINE`) from ID-only or Name-only partial matches (`FALSE POSITIVE`) strictly from verified text evidence or deep document verification (up to 4 documents per search).
- **Strict Security Hardening (`CWE-79`, `CWE-601`, `CWE-1021`, `CWE-1333`):** Enforces a strict Content Security Policy (`default-src 'none'; script-src 'self'; style-src 'self'; connect-src https://api.allorigins.win https://api.codetabs.com https://r.jina.ai; ...`), zero `innerHTML`, `https:`-only link validation with `rel="noopener noreferrer"`, and top-frame clickjacking protection.

### Local Verification & Running Locally
1. **Run Automated Unit & Security Tests (Node.js 18+):**
   ```bash
   node --test vibe-code-project/ou-student-id-leak-checker/app.test.js
   # Or via npm script:
   npm --prefix vibe-code-project/ou-student-id-leak-checker test
   ```
2. **Start a Local Static Server:**
   ```bash
   npx serve .
   # Or using Python:
   python -m http.server 8080 --directory vibe-code-project/ou-student-id-leak-checker
   ```
   Then open `http://localhost:8080/index.html` (or `http://localhost:3000/vibe-code-project/ou-student-id-leak-checker/index.html`) in your browser.

### Live GitHub Pages Paths
When deployed via GitHub Pages from the `main` branch root (`/`):
- **Self-Check Tool:** `/vibe-code-project/ou-student-id-leak-checker/` (`index.html`)
- **Legal Disclaimer & Privacy Notice:** `/vibe-code-project/ou-student-id-leak-checker/disclaimer.html`
- **404 Fallback Page:** `/vibe-code-project/ou-student-id-leak-checker/404.html`
