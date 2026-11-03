class Solution {
public:
    string lexSmallestAfterDeletion(string s) {
        int freq[26] = {};

        for (char c : s)
            ++freq[c - 'a'];

        const size_t n = s.size();
        size_t top = 0;

        for (size_t i = 0; i < n; ++i) {
            const char c = s[i];

            while (top > 0 &&
                   s[top - 1] > c &&
                   freq[s[top - 1] - 'a'] > 1) {
                --freq[s[top - 1] - 'a'];
                --top;
            }

            s[top++] = c;
        }

        while (top > 0 && freq[s[top - 1] - 'a'] > 1) {
            --freq[s[top - 1] - 'a'];
            --top;
        }

        s.resize(top);
        return s;
    }
};