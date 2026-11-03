class Solution {
public:
    int sumOfGoodIntegers(int n, int k) {
        int ans = 0;
        int s = max(n-k, 1);
        for(int i = s; i<=n+k; i++){
            if( (i&n) == 0) {ans+=i; cout<<i<<'\n';}
        }
        return ans;
    }
};