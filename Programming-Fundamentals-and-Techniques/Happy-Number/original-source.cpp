class Solution {
public:
    bool isHappy(int n) {
        int dividend = 0;
        int remainder = 0;
        unordered_set<int> happy_cache;
        while (true) {
            if (n == 1) {
                return true;
            }
            if (happy_cache.count(n) > 0) {
                return false;
            }
            happy_cache.insert(n);
            dividend = n;
            while (dividend / 10 != 0) {
                remainder += (dividend % 10) * (dividend % 10);
                dividend /= 10;
            }
            remainder += dividend * dividend;
            n = remainder;
            remainder = 0;
        }
    }
};