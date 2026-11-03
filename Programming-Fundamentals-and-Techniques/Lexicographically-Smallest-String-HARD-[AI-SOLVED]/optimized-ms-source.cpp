class Solution {
public:
    string lexSmallestAfterDeletion(string s) {
        static array<char, 100000> st;
        static array<uint, 127> l;
        static array<uint, 127> r;
        static const auto f{[](int ch) { return r[ch] || l[ch] > 1; }};
        
        fill_n(l.data() + 'a', 26, 0);
        fill_n(r.data() + 'a', 26, 0);
        for (const auto ch : s) {
            ++r[ch];
        }
        
        size_t top{~0UL};
        for (const auto ch : s) {
            --r[ch];
            while (~top && ch < st[top] && (r[st[top]] || l[st[top]] > 1)) {
                --l[st[top--]];
            }
            ++l[st[++top] = ch];
        }
        
        while (~top && l[st[top]] > 1) {
            --l[st[top--]];
        }
        
        return {st.data(), st.data() + top + 1};
    }
};