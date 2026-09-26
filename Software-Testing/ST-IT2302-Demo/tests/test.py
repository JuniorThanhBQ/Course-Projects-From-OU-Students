import math 
import time 
import unittest 
 
def is_prime(n): 
    if n < 2: 
        raise ValueError('Invalid Number') 
 
    for i in range(2, math.isqrt(n)): 
        if n % i == 0: 
            return False 
 
    return True 
 
class TestPrime(unittest.TestCase): 
    def test_true(self): 
        self.assertTrue(is_prime(2)) 
 
    def test_false(self): 
        self.assertFalse(is_prime(4)) 
 
    def test_exception(self): 
        with self.assertRaises(ValueError): 
            is_prime(1) 
 
    def test_timeout(self): 
        start = time.time() 
        is_prime(9999) 
        end = time.time() 
        self.assertLess(end - start, 3)