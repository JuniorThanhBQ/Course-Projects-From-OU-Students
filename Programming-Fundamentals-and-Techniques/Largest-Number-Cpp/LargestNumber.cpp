#include <iostream>
#include <vector>
#include <string>
#include <algorithm>
using namespace std;

class Solution {
public:
    int compareTwoNumbers(int x, int y) {
        string sx = to_string(x);
        string sy = to_string(y);

        if (sx + sy > sy + sx)
            return -1; 
        return 0;
    }

    int partition(vector<int>& nums, int x, int y) {
        int pivot = nums[y];
        int i = x - 1;

        for (int j = x; j <= y-1; j++) {
            if (compareTwoNumbers(nums[j], pivot) == -1) {
                i++;
                swap(nums[i], nums[j]);
            }
        }

        swap(nums[i+1],nums[y]);
        return i + 1;
    }

    void quickSortVector(vector<int>& nums,int x, int y) {
        if (x < y) {
            int index = partition(nums, x, y);
            quickSortVector(nums, x, index - 1);
            quickSortVector(nums, index + 1, y);
        }
    }

    string largestNumber(vector<int>& nums) {
        string output = "";
        quickSortVector(nums,0, nums.size()-1);

        if (nums[0] == 0)
            return "0";

        for (int i : nums)
            output += to_string(i);
        return output;
    }
};

int main() {
    vector<int> nums = {135, 247, 396, 41, 9};
    Solution leetCode;
    cout << leetCode.largestNumber(nums) << endl;
    return 1;
}