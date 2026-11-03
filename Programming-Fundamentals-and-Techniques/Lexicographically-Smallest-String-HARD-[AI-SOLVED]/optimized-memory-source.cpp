class Solution {
public:
    string lexSmallestAfterDeletion(string& s) {
        string res;
        int f1[26]{}, f2[26]{};

        for (char& c : s)
            ++f2[c - 'a'];

        for (char& c : s) {
            --f2[c - 'a'];

            while (!res.empty() && res.back() > c &&
                   (f2[res.back() - 'a'] > 0 || f1[res.back() - 'a'] > 1))
                --f1[res.back() - 'a'], res.pop_back();

            res.push_back(c), ++f1[c - 'a'];
        }

        while (!res.empty() && f1[res.back() - 'a'] > 1)
            --f1[res.back() - 'a'], res.pop_back();

        return res;
    }
};