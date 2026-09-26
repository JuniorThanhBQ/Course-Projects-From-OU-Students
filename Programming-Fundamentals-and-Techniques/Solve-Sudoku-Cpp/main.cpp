#include <iostream>
#include <cmath>
using namespace std;

/*
Bài tập Sudoku của KTLT:
1. Áp dụng thành thạo mảng hai chiều
2. Có sử dụng đệ quy (Tiêu biểu là đệ quy lùi)
3. Phải thao tác thành thạo các biến đệ quy return với đệ quy thông thường

Phạm vi áp dụng: Thi giữa kì KTLT với chương 1,2.
*/

//Hàm trang trí hiển thị Sudoku
void hienThi(int Arr[][9]) {
	cout << "	     SUDOKU	               " << endl;
	cout << "+-----------------------------+" << endl;

	for (int i = 0; i < 9; i++) {
		for (int j = 0; j < 9; j++) {
			if (j == 0)
				cout << "|";

			if (Arr[i][j] != -1)
				cout << " " << Arr[i][j] << " ";
			else
				cout << "   ";

			if ((j + 1) % 3 == 0) 
				cout << "|";
		}

		if ((i + 1) % 3 == 0 && i != 8)
			cout << "\n|-----------------------------|\n";
		else {
			if(i == 8)
				cout << "\n+-----------------------------+" << endl;
			else
				cout << endl << endl;
		}
	}
}

bool kiemTraSudocu(int Arr[][9], int rol, int col, int x) {
	//Kiểm tra cột
	for (int i = 0; i < 9; i++) {
		if ((Arr[i][col] == x)) {
			return false;
		}
	}

	//Kiểm tra hàng
	for (int j = 0; j < 9; j++) {
		if ((Arr[rol][j] == x)) {
			return false;
		}
	}

	//Kiểm tra ô 3x3. 
	for (int i = (rol/3)*3; i < (rol/3)*3+3; i++) {
		for (int j = (col/3)*3; j < (col/3)*3+3; j++) {
			if ((Arr[i][j] == x))
			return false;
		}
	}

	return true;
}

bool giaiSudocu(int Arr[][9], int rol, int col) {
	//Nếu đã điền đủ 9x9 thì thoát trả về đáp án
	if (rol == 9 && col == 9) {
		return true;
	}
	
	//Nếu chưa điền đủ thì cập nhật hàng (nếu cột đi đủ 9 ô trên 1 dòng)
	if (col == 9) {
		rol++;
		col = 0;
	}
	
	if (Arr[rol][col] != -1) {
		return giaiSudocu(Arr, rol, col + 1);
	}

	for (int i = 1; i <= 9; i++) {
		if (kiemTraSudocu(Arr, rol, col, i)) {
			Arr[rol][col] = i;

			//Hai dòng bên dưới này sẽ cho bạn xem cách C++ giải một sudoku
			system("cls");
			hienThi(Arr);

			if (giaiSudocu(Arr, rol, col)) {
				return true;
			}

			Arr[rol][col] = -1;
		}
	}
	return false;
}

int main() {
	//Điền các dữ liệu cho từng ô sudoku với -1 là trống
	int Arr[][9] = {
		{-1,-1,3,7,1,4,-1,-1,-1},
		{6,-1,7,-1,-1,-1,-1,-1,-1},
		{5,-1,2,3,8,-1,4,-1,7},
		{4,-1,-1,-1,-1,1,-1,-1,-1},
		{-1,-1,-1,-1,-1,-1,-1,6,-1},
		{-1,-1,1,2,7,-1,8,-1,-1},
		{9,-1,-1,-1,-1,-1,-1,8,-1},
		{-1,3,-1,-1,-1,-1,-1,-1,-1},
		{2,-1,-1,-1,-1,9,-1,5,6},
	};

	hienThi(Arr);

	if (giaiSudocu(Arr, 0, 0)) {
		system("cls");
		cout << "Dap an bai giai: " << endl;
		hienThi(Arr);
	}
	else {
		cout << "Khong the giai bai toan!" << endl;
	}

	return 0;
}
