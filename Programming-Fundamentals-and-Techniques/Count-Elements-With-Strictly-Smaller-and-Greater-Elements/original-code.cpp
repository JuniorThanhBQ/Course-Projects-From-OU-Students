class Solution {
public:
    int countElements(vector<int>& nums) {
        auto min_it = std::min_element(nums.begin(), nums.end());
        auto max_it = std::max_element(nums.begin(), nums.end());
        int min_val = *min_it;
        int max_val = *max_it;
        int result = 0;
        for(int i : nums){
            if(i > min_val && i < max_val){
                result++;
            }
        }
        return result;
    }
};