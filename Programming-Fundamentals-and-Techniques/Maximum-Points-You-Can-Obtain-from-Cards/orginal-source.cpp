class Solution {
public:
    int maxScore(vector<int>& cardPoints, int k) {
        int final_score = 0;
        int n = cardPoints.size();
        for (int i = 0; i < k; i++) {
            final_score += cardPoints[i];
        }

        int current_score = final_score;
        for (int i = 0; i < k; i++) {
            current_score -= cardPoints[k - 1 - i];
            current_score += cardPoints[n - 1 - i];

            final_score = std::max(final_score, current_score);
        }

        return final_score;
    }
};