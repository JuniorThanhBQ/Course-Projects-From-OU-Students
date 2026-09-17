# Viết hàm Python xét học bổng nhận đầu vào là một mảng điểm:
# Ràng buộc: tối thiểu điểm 2 môn, tối đa 7 môn, sinh viên được xem là có học bổng
# nếu điểm các môn đều trên 5, trung bình từ 7.5 trở lên (đạt học bổng loại 2), từ 8.5
# trở lên đạt học bổng loại 1.
# Cách tính điểm trung bình: hai môn đầu tiên sẽ nhân 2, chia trung bình tổng số môn + 2.
# Yêu cầu 1: Viết Unit Test kiểm thử logic tính điểm trung bình.
# Yêu cầu 2: Viết Unit Test kiểm thử logic xét học bổng.

import pytest

def calculate_average(score):
    average_score = 0.0
    for i in range(0,len(score)):
        if i == 0 or i == 1:
            average_score += score[i] * 2
        else:
            average_score += score[i]
    return round(average_score/(len(score)+2),1)

def is_pass_scholarship(score):
    if type(score) != list:
        return TypeError('Invalid args type')

    if len(score) < 2 or len(score) > 7:
        return ValueError('Invalid Score Array')

    for i in score:
        if i < 0 or i > 10:
            return ValueError('Invalid Score')
        if i <= 5:
            return False

    if calculate_average(score) <= 7.5:
        return False
    elif calculate_average(score) <= 8.5:
        return "Học bổng loại 2"
    else:
        return "Học bổng loại 1"

class TestScholarshipManager:
    def test_caculate_average(self):
        score = [5,7,8,3]
        assert calculate_average(score) == 5.8

    def test_is_pass_scholarship(self):
        score = [10, 7, 8, 6]
        assert is_pass_scholarship(score) == "Học bổng loại 2"

    @pytest.mark.parametrize("n, expected", [
        ([5, 7, 8, 6], 6.3),
        ([10, 7, 8, 6, 3], 7.3),
        ([5, 7, 8, 6, 9, 7], 6.8),
        ([9, 10, 5, 8, 9, 7, 10], 8.6)
    ])
    def test_all(self, n, expected):
        assert calculate_average(n) == expected

    @pytest.mark.parametrize("n, expected", [
        ([5, 7, 8, 6], False),
        ([10, 7, 8, 6, 3], False),
        ([8, 7, 8, 7, 9, 7], 'Học bổng loại 2'),
        ([9, 10, 5, 8, 9, 7, 10], 'Học bổng loại 1')
    ])
    def test_all(self, n, expected):
        assert is_pass_scholarship(n) == expected
