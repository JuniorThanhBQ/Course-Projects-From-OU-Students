from django.urls import path, include
from LMS import views
from rest_framework.routers import DefaultRouter

r = DefaultRouter()
r.register('topics', views.TopicView, basename='topic')
r.register('levels', views.LevelView, basename='level')
r.register('subjects', views.SubjectView, basename='subject')

r.register('resources', views.ResourceView, basename='resource')
r.register('users', views.UserView, basename='user')

urlpatterns = [
    path('', include(r.urls))
]