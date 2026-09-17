from rest_framework import viewsets, generics, status, parsers, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from LMS import serializers, paginators
from LMS.models import Topic, Subject, Resource, Level, User

class TopicView(viewsets.ViewSet, generics.ListAPIView):
    queryset = Topic.objects.all()
    serializer_class = serializers.TopicSerializer

class ResourceView(viewsets.ViewSet, generics.ListAPIView):
    queryset = Resource.objects.all()
    serializer_class = serializers.ResourceSerializer

class LevelView(viewsets.ViewSet,  generics.ListAPIView):
    queryset = Level.objects.all()
    serializer_class = serializers.LevelSerializer


class SubjectView(viewsets.ViewSet, generics.ListAPIView):
    queryset = Subject.objects.all()
    serializer_class = serializers.SubjectSerializer
    pagination_class = paginators.ItemPaginator
    #
    # def get_queryset(self):
    #     query = self.queryset
    #
    #     q = self.request.query_params.get('q')
    #     if q:
    #         query = query.filter(subject__icontains=q)
    #
    #     cate_id = self.request.query_params.get('category_id')
    #     if cate_id:
    #         query = query.filter(category_id=cate_id)
    #
    #     return query
    #
    # @action(methods=['get'], url_path='lessons', detail=True)
    # def get_lessons(self, request, pk):
    #     lessons = self.get_object().lesson_set.filter(active=True)
    #
    #     return Response(serializers.LessonSerializer(lessons, many=True).data, status=status.HTTP_200_OK)


class UserView(viewsets.ViewSet, generics.CreateAPIView):
    queryset = User.objects.filter(is_active=True)
    serializer_class = serializers.UserSerializer
    parser_classes = [parsers.MultiPartParser]

    @action(methods=['get', 'patch'], url_path='current-user', detail=False, permission_classes=[permissions.IsAuthenticated])
    def get_current_user(self, request):
        user = request.user
        if request.method.__eq__('PATCH'):
            s = serializers.UserSerializer(user, data=request.data, partial=True)
            s.is_valid(raise_exception=True)
            s.save()

        return Response(serializers.UserSerializer(user).data, status=status.HTTP_200_OK)

