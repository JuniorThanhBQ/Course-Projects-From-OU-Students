class Solution {
public:
    bool isNumber(string& s) {
        bool signSet = false;
        bool decimalSet = false;
        bool hasNumber = false;
        bool hasE = false;
        for(char i : s){
            switch(i){
                case 'e':
                case 'E':
                    if(!hasNumber || hasE){
                        return false;
                    }
                    hasE = true;
                    signSet = false;
                    decimalSet = true;
                    hasNumber = false;
                    break;
                case '.':
                    if(decimalSet){
                        return false;
                    }
                    decimalSet = true;
                    signSet = true;
                    break;
                case '-':
                case '+':
                    if(signSet){
                        return false;
                    }
                    signSet = true;
                    break;
                default:
                    if(!std::isdigit(i)){
                        return false;
                    }
                    hasNumber = true;
                    signSet = true;

            }
        }
        return hasNumber;
    }
};