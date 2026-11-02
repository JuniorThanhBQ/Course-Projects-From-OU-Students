class Solution {
public:
    int lastRemaining(int n) {
        int head = 1;
        int step = 1;
        bool isLeft = true;

        while (n > 1) {
            if (isLeft || n % 2 == 1) {
                head += step;
            }

            n /= 2;
            step *= 2;
            isLeft = !isLeft;
        }

        return head;
    }
};
