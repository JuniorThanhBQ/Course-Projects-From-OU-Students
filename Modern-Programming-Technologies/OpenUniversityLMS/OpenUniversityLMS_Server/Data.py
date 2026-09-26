# -*- coding: utf-8 -*-
from LMS.models import Subject, Level, Topic, Resource
s1, _ = Subject.objects.get_or_create(name="Các công nghệ lập trình hiện đại", description="Môn các công nghệ lập trình hiện đại của nhóm Trinh và Thành")
t1, _ = Topic.objects.get_or_create(name="Django")
t2, _ = Topic.objects.get_or_create(name="React Native")
l1, _ = Level.objects.get_or_create(name='1',note="lý thuyết")
l2, _ = Level.objects.get_or_create(name='2',note="Thực hành")
l3, _ = Level.objects.get_or_create(name='3',note="Tài liệu tham khảo")
