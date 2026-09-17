#include <iostream>
#include <string>
#include <vector>
using namespace std;

int SolveX(int &x1, int x2) {
	int output = x1 % x2;
	x1 = x2;
	return output;
}
int SolveY(int x1, int x2) {
	return x1 / x2;
}
int SolveB(int &b2, int &b3, int y) {
	int output = b2 - (b3 * y);
	b2 = b3;
	return output;
}
int SolveEuclide(int x, int a) {
	int b = 1, b2 = 0, y = 0;

	while (a > 1){
		y = SolveY(x, a);
		b = SolveB(b2, b, y);
		a = SolveX(x, a);
	}

	if (b < 0)
		b = (b + 26) % 26;
	return b;
}
int AffineDecoding_Encoding(int x, int k1, int k2, bool type) {
	int output = 0;
	if (type) {
		output = SolveEuclide(26, k1) * (x - k2) % 26;

		if (output >= 0)
			return output;

		return 26 + output;
	}
	else
		return (k1 * x + k2) % 26;
}
string SolveAffine() {
	int k1, k2;
	bool decoding = true;
	string word = "";

	cout << "Input word: ";
	getline(cin, word);
	cout << "\nType of Affine (0 for decoding, 1 for encoding), k1, k2: ";
	cin >> decoding >> k1 >> k2;

	string output = "";
	for (int i = 0; i < word.size(); i++) {
		if (word[i] != ' ')
			output += char(AffineDecoding_Encoding(word[i] - 65, k1, k2, decoding) + 65);
		else
			output += ' ';
	}


	return output;
}

int mod(int a, int m) {
	return (a % m + m) % m;
}

string CeasarDecoding_Encoding(string x, int k, bool type) {
	string output = "";
	for (int i = 0; i < x.size(); i++) {
		if(type)
			output += mod((int(x[i]) - 65 - k), 26) + 65;
		else
			output += mod((int(x[i]) - 65 + k), 26) + 65;
	}
	return output;
}
string SolveCeasar() {
	int k = 0;
	bool decoding = true;
	string word = "";

	cout << "Input word: ";
	cin.ignore();
	getline(cin, word);
	cout << "\nType of Ceasar (0 for decoding, 1 for encoding) and k: ";
	cin >> decoding >> k;

	return CeasarDecoding_Encoding(word, k, decoding);
}

string VigenereDecoding_Encoding(string x, string k, bool type) {
	string output = "";
	int countCurrentK = 0;

	for (int i = 0; i < x.size(); i++) {
		if(type)
			output += mod((int(x[i]) - int(k[countCurrentK++]) - 65 * 2), 26) + 65;
		else
			output += mod((int(x[i]) + int(k[countCurrentK++]) - 65 * 2), 26) + 65;

		if (countCurrentK >= k.size())
			countCurrentK = 0;
	}
	return output;
}
string SolveVigenere() {
	string k = "", word = "";
	bool decoding = true;

	cout << "Input word: ";
	cin.ignore();
	getline(cin, word);

	cout << "\nType of Vigenere (0 for decoding, 1 for encoding) and k: ";
	cin >> decoding;
	cin.ignore();
	getline(cin, k);

	return VigenereDecoding_Encoding(word, k, decoding);
}

int DetK(int arr[2][2]) {
	return arr[0][0] * arr[1][1] - arr[0][1] * arr[1][0];
}

int DetKDelta(int arr[2][2]) {
	return SolveEuclide(26, DetK(arr));
}

void updateK(int (&arr)[2][2], int delta) {
	int temp = arr[0][0];
	arr[0][0] = arr[1][1];
	arr[1][1] = temp;
	arr[0][1] *= -1;
	arr[1][0] *= -1;
	for (int i = 0; i < 2; i++)
		for (int j = 0; j < 2; j++) {
			arr[i][j] = mod(arr[i][j] * delta, 26);
		}
}

string HillDecoding_Encoding(string x, int(&arr)[2][2], bool type) {
	string output = "";
	if(!type)
		updateK(arr, DetKDelta(arr));

	for (int i = 0; i < x.size(); i += 2) {
			output += mod(((int(x[i]) - 65) * arr[0][0] + (int(x[i + 1]) - 65) * arr[1][0]), 26) + 65;
			output += mod(((int(x[i]) - 65) * arr[0][1] + (int(x[i + 1]) - 65) * arr[1][1]), 26) + 65;
	}
	return output;
}

string SolveHill() {
	int k[2][2];
	string word = "";
	bool decoding = true;

	cout << "Input word: ";
	cin.ignore();
	getline(cin, word);

	cout << "\nType of Hill (0 for decoding, 1 for encoding) and k1, k2, k3, k4: ";
	cin >> decoding;
	for (int i = 0; i < 2; i++)
		for (int j = 0; j < 2; j++)
			cin >> k[i][j];

	return HillDecoding_Encoding(word, k, decoding);
}
void Initialize_PlayFairTable(string k, int(&arr)[50][50]) {
    string key = "";
    vector<bool> seen(26, false);
    for (char ch : k) {
        if (!isalpha((unsigned char)ch)) continue;
        ch = tolower((unsigned char)ch);
        if (ch == 'j') ch = 'i';
        int idx = ch - 'a';
        if (!seen[idx]) {
            if (ch == 'i') {
                if (!seen['i' - 'a']) seen['i' - 'a'] = true;
            }
            else {
                seen[idx] = true;
            }
            key.push_back(ch);
        }
    }

     for (char c = 'a'; c <= 'z'; ++c) {
        if (c == 'j') continue; 
        if (!seen[c - 'a']) {
            key.push_back(c);
            seen[c - 'a'] = true;
        }
    }

    for (int i = 0; i < 50; ++i) for (int j = 0; j < 50; ++j) arr[i][j] = -1;
    int r = 0, c = 0;
    for (char ch : key) {
        arr[r][c] = ch - 'a';
        c++;
        if (c == 5) { c = 0; r++; }
    }
}

static void findPosition(int val, int(&arr)[50][50], int& r, int& c) {
    for (int i = 0; i < 5; ++i) for (int j = 0; j < 5; ++j) {
        if (arr[i][j] == val) { r = i; c = j; return; }
    }
    r = c = -1;
}

string preprocessPlainForEncoding(string s) {
  
    string t;
    for (char ch : s) {
        if (!isalpha((unsigned char)ch)) continue;
        ch = tolower((unsigned char)ch);
        if (ch == 'j') ch = 'i';
        t.push_back(ch);
    }
  
    string out;
    for (size_t i = 0; i < t.size(); ) {
        char a = t[i];
        char b = (i + 1 < t.size()) ? t[i + 1] : '\0';
        if (b == '\0') {
            out.push_back(a);
            out.push_back('x');
            i += 1;
        }
        else if (a == b) {
            out.push_back(a);
            out.push_back('x');
            i += 1;
        }
        else {
            out.push_back(a);
            out.push_back(b);
            i += 2;
        }
    }
    return out;
}

string PlayfairEncoding(string x, int(&arr)[50][50]) {
    string cleaned = preprocessPlainForEncoding(x);
    string output;
    for (size_t i = 0; i < cleaned.size(); i += 2) {
        char a = cleaned[i], b = cleaned[i + 1];
        int va = a - 'a', vb = b - 'a';
        int ra, ca, rb, cb;
        findPosition(va, arr, ra, ca);
        findPosition(vb, arr, rb, cb);
        if (ra == rb) {
         
            int na = arr[ra][(ca + 1) % 5];
            int nb = arr[rb][(cb + 1) % 5];
            output.push_back(char(na + 'a'));
            output.push_back(char(nb + 'a'));
        }
        else if (ca == cb) {
           
            int na = arr[(ra + 1) % 5][ca];
            int nb = arr[(rb + 1) % 5][cb];
            output.push_back(char(na + 'a'));
            output.push_back(char(nb + 'a'));
        }
        else {
   
            int na = arr[ra][cb];
            int nb = arr[rb][ca];
            output.push_back(char(na + 'a'));
            output.push_back(char(nb + 'a'));
        }
    }
    return output;
}

string PlayfairDecoding(string x, int(&arr)[50][50]) {

    string t;
    for (char ch : x) {
        if (!isalpha((unsigned char)ch)) continue;
        ch = tolower((unsigned char)ch);
        if (ch == 'j') ch = 'i';
        t.push_back(ch);
    }

    if (t.size() % 2 != 0) t.push_back('x');

    string output;
    for (size_t i = 0; i < t.size(); i += 2) {
        char a = t[i], b = t[i + 1];
        int va = a - 'a', vb = b - 'a';
        int ra, ca, rb, cb;
        findPosition(va, arr, ra, ca);
        findPosition(vb, arr, rb, cb);
        if (ra == rb) {

            int na = arr[ra][(ca + 5 - 1) % 5];
            int nb = arr[rb][(cb + 5 - 1) % 5];
            output.push_back(char(na + 'a'));
            output.push_back(char(nb + 'a'));
        }
        else if (ca == cb) {

            int na = arr[(ra + 5 - 1) % 5][ca];
            int nb = arr[(rb + 5 - 1) % 5][cb];
            output.push_back(char(na + 'a'));
            output.push_back(char(nb + 'a'));
        }
        else {
       
            int na = arr[ra][cb];
            int nb = arr[rb][ca];
            output.push_back(char(na + 'a'));
            output.push_back(char(nb + 'a'));
        }
    }


    string cleaned;
    for (size_t i = 0; i < output.size(); ++i) {
        if (i + 2 < output.size() && output[i] == output[i + 2] && output[i + 1] == 'x') {
            cleaned.push_back(output[i]);
        }
        else {
            cleaned.push_back(output[i]);
        }
    }


    if (!cleaned.empty() && cleaned.back() == 'x') {
        cleaned.pop_back();
    }

    return cleaned;
}

string SolvePlayFair() {
    string k = "";
    bool decoding = true;
    string word = "";

    cout << "Input word: ";
    cin.ignore(numeric_limits<streamsize>::max(), '\n');
    getline(cin, word);
    cout << "\nType of Playfair (1 for decoding, 0 for encoding) and k: ";
    int modeInt = 1;
    cin >> modeInt;
    decoding = (modeInt != 0);
    cin.ignore(numeric_limits<streamsize>::max(), '\n');
    getline(cin, k);

    int arr[50][50];
    Initialize_PlayFairTable(k, arr);

    if (decoding) {
        word = PlayfairDecoding(word, arr);
    }
    else {
        word = PlayfairEncoding(word, arr);
    }
    return word;
}

const string listTemlate = "\
=========== Menu tool ==========\n\
1. Ceasar tool\n\
2. Vigenere tool\n\
3. Playfair tool\n\
4. Affair tool\n\
5. Ecluid tool\n\
6. Hill tool\n\
7. Diffie-Hellman\n\
0. Exit \n\
================================\n\
";

void ToolsMenu() {
	char selection = -1;
	while (selection != '0') {
		cout << listTemlate << endl;
		cout << "Input your choice [0-7]: "; cin >> selection;
		switch (selection)
		{
			case '1':
			{
				cout << SolveCeasar() << endl;
				break;
			}
			case '2':
			{
				cout << SolveVigenere() << endl;
				break;
			}
			case '3':
			{
				cout << SolvePlayFair() << endl;
				break;
			}
			case '4':
			{
				cout << SolveAffine() << endl;
				break;
			}
			case '5':
			{
				int x = 0, a = 0;
				cout << "Input x, a: "; cin >> x >> a;
				cout << SolveEuclide(x,a)<< endl;
				break;
			}
			case '6':
			{
				cout << SolveHill() << endl;
				break;
			}
			case '7':
			{
				cout << "Not available" << endl;
				break;
			}
			default:
				if(selection != '0')
					cout << "Input is invalid!" << endl;
		}
	}
}

int main() {
	ToolsMenu();
	system("pause");
	return 1;
}