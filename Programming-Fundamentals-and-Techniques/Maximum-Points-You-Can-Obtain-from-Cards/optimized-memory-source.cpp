class Solution {
public:
    int maxScore(vector<int>& nums, int k) {
        int sum = 0 ;
        int n = nums.size();
        int curr = 0 ;
        for(int i = 0 ; i < n ;i++){
            sum += nums[i];
            if(i<n-k) curr += nums[i] ;
        }
        if(k==n) return sum;
        int i = n-k ;
        int j = 0 ;
        int ans = curr;
        while(i<n){
            curr-=nums[j];
            j++;
            curr+=nums[i];
            i++;
            ans = min(ans,curr);
        }
        return sum-ans;
    }
};
#pragma GCC optimize("Ofast")

#include <iostream>

static constexpr std::size_t max_align = alignof(std::max_align_t);
alignas(max_align) static unsigned char BUFFER[64 * 1024 * 1024];
static std::size_t pos = 0;

void *operator new(const std::size_t size) {
    const std::size_t padding = (max_align - (pos % max_align)) % max_align;
    pos += padding + size;
    return static_cast<void *>(&BUFFER[pos - size]);
}

void *operator new[](const std::size_t size) {
    return operator new(size);
}

void operator delete(void *) noexcept {}

void operator delete[](void *) noexcept {}

void operator delete(void *, std::size_t) noexcept {}

void operator delete[](void *, std::size_t) noexcept {}