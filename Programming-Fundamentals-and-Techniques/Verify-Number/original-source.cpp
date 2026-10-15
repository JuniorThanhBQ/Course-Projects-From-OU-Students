class Solution {
public:
    bool isValidOptional(string s, int &s_length){
        char optional_array[] = {'e', 'E', '+', '-', '.'};
        for(char i : optional_array){
            long count_optional = count(s.begin(), s.end(), i);
            if(i == 'e' || i == 'E'){
                long count_exponent = count(s.begin(), s.end(), 'e')
                                    + count(s.begin(), s.end(), 'E');
                if(count_exponent > 1){
                    return false;
                }
            }
            else if(i == '.' && count_optional > 1){
                return false;
            }
            if((i == 'e' || i == 'E') && s[0] == i){
                return false;
            }
            if((i == 'e' || i == 'E' || i == '+' || i == '-')
                && s[s_length - 1] == i){
                return false;
            }
        }
        return true;
    }

    bool isValidString(string s){
        int s_length = s.length();
        if(s_length > 0 && s_length <= 20){
            if(isValidOptional(s, s_length)){
                bool hasDigit = false;
                bool hasExponent = false;
                bool hasDot = false;
                for(int i = 0; i < s_length; i++){
                    if(isdigit(s[i])){
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
        }
        return false;
    }

    bool isNumber(string s) {
        if(!isValidString(s)){
            return false;
        }
        return true;
    }
};
