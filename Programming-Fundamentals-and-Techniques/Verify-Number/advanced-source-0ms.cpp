class Solution {
public:
    bool isNumber(string s) {
        int s_length = s.length();
        if(s_length > 0 && s_length <= 20){
            bool hasDigit = false;
            bool hasExponent = false;
            bool hasDot = false;
            for(int i = 0; i < s_length; i++){
                if(s[i] >= '0' && s[i] <= '9'){
                    hasDigit = true;
                }
                else if(s[i] == '+' || s[i] == '-'){                    
                    if(i != 0 && s[i-1] != 'e' && s[i-1] != 'E'){
                        return false;
                    }
                }
                else if(s[i] == '.'){
                    if(hasDot || hasExponent){
                        return false;
                    }
                    hasDot = true;
                }
                else if(s[i] == 'e' || s[i] == 'E'){
                    if(hasExponent || !hasDigit){
                        return false;
                    }
                    hasExponent = true;
                    hasDigit = false;
                }
                else {
                    return false;
                }
            }
            return hasDigit;
        }
        return false;
    }
};
