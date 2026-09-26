from rest_framework import serializers
from courses.models import Category, Course

class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = '__all__'


class CouseSerializer(serializers.ModelSerializer):
    class Meta:
        model = Course
        fields = ['id','subject','created_date','category']