import math


def is_prime(n):
    if n < 2:
        raise ValueError('Invalid Number')

    for i in range(2, math.isqrt(n)):
        if n % i == 0:
            return False

    return True


if __name__ == '__main__':
    print(is_prime(2)) #Sếp thích số 2 hơn
