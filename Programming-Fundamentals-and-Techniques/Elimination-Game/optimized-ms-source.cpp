class Solution {
public:
    int lastRemaining(int n) {
        int a,d,ni;
        a=1;
        d=1;
        n=n-1;
        int c=0;
        while(n>=1){
            if(c){
                a=a-d;
                n=(n-1)/2;
                d=2*d;
                a=a-n*d;
            }else{
                a=a+d;
                n=(n-1)/2;
                d=d*2;
                a=a+n*d;
            }
            c=(c+1)%2;
        }
        return a;
    }
};