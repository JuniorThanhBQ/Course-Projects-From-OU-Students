class Solution {
public:
    int firstUniqChar(string s) {
        int repeated_char[26] = {0};
        for(char c : s) {
            repeated_char[c - 'a']++;
        }
        for(int i = 0; i < s.length(); i++) {
            if(repeated_char[s[i] - 'a'] == 1) {
                return i;
            }
        }
        return -1;
    }
};