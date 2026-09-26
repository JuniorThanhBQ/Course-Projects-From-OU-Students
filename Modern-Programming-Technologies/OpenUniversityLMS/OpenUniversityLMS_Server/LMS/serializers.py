from rest_framework.exceptions import ValidationError
from LMS.models import Topic, Subject, Resource, Level, User
from rest_framework import serializers

class TopicSerializer(serializers.ModelSerializer):
    class Meta:
        model = Topic
        fields = ['id', 'name']

class LevelSerializer(serializers.ModelSerializer):
    class Meta:
        model = Level
        fields = ['id', 'name', 'note']

class SubjectSerializer(serializers.ModelSerializer):
    class Meta:
        model = Subject
        fields = ['id', 'description', 'created_date']

class ResourceSerializer(serializers.ModelSerializer):
    class Meta:
        model = Resource
        fields = ['id', 'name', 'description', 'created_date']


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['first_name', 'last_name', 'username', 'password', 'avatar']
        extra_kwargs = {
            'password': {
                'write_only': True
            }
        }

    def to_representation(self, instance):
        data = super().to_representation(instance)
        if instance.avatar:
            data['avatar'] = instance.avatar.url

        return data

    def create(self, validated_data):
        user = User(**validated_data)
        user.set_password(user.password)
        user.save()

        return user

    def update(self, instance, validated_data):
        keys = set(validated_data.keys())
        if keys - {'first_name', 'last_name', 'email'}:
            raise ValidationError({'error': 'Invalid fields'})

        return super().update(instance, validated_data)
