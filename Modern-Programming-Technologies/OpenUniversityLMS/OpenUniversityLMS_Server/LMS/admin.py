# from django.contrib import admin
# from django.db.models import Count
# from django.template.response import TemplateResponse
# from django.utils.safestring import mark_safe
# from courses.models import Category, Course, Lesson, Tag, Comment
# from django import forms
# from ckeditor_uploader.widgets import CKEditorUploadingWidget
# from django.urls import path
#
#
# class LessonForm(forms.ModelForm):
#     content = forms.CharField(widget=CKEditorUploadingWidget)
#
#     class Meta:
#         model = Lesson
#         fields = '__all__'
#
#
# class CourseAdmin(admin.ModelAdmin):
#     list_display = ['id', 'subject', 'created_date', 'active']
#     search_fields = ['subject']
#     list_filter = ['id', 'subject', 'created_date']
#     readonly_fields = ['image_view']
#
#     def image_view(self, course):
#         return mark_safe(f"<img src='/static/{course.image.name}' width='120' />")
#
#     class Media:
#         css = {
#             'all': ('/static/css/styles.css', )
#         }
#
#
# class LessonAdmin(admin.ModelAdmin):
#     form = LessonForm
#
#
# class MyAdminSite(admin.AdminSite):
#     site_header = 'eCourse Online'
#
#     def get_urls(self):
#         return [path('course-stats/', self.stats_view)] + super().get_urls()
#
#     def stats_view(self, request):
#         # [{'id': 1, 'name': 'Software Engineering', 'count': 4}, {'id': 2, 'name': 'Artificial Intelligence', 'count': 1}, {'id': 3, 'name': 'Data Sciences', 'count': 1}]
#         stats = Category.objects.annotate(count=Count('course')).values('id', 'name', 'count')
#         return TemplateResponse(request, 'admin/stats.html', {'stats': stats})
#
# admin_site = MyAdminSite(name='eCourse')
#
# admin_site.register(Category)
# admin_site.register(Tag)
# admin_site.register(Comment)
# admin_site.register(Course, CourseAdmin)
# admin_site.register(Lesson, LessonAdmin)

from django.contrib import admin
from django.utils.safestring import mark_safe
from LMS.models import Topic, Subject, Resource, Level
from django import forms
from ckeditor_uploader.widgets import CKEditorUploadingWidget

class ResourceForm(forms.ModelForm):
    description = forms.CharField(widget=CKEditorUploadingWidget)

    class Meta:
        model = Resource
        fields = '__all__'


class SubjectAdmin(admin.ModelAdmin):
    list_display = ['id', 'name','description', 'created_date']
    search_fields = ['name']
    list_filter = ['name', 'created_date']


class ResourceAdmin(admin.ModelAdmin):
    list_display = ['id', 'name', 'description', 'topic', 'level' ,'created_date', 'active']
    search_fields = ['name']
    list_filter = ['name']
    ordering = ['level']

    form = ResourceForm

class MyAdminSite(admin.AdminSite):
    site_header = 'LMS Open University'

admin_site = MyAdminSite(name='LMSOpenUniversity')

admin_site.register(Topic)
admin_site.register(Level)
admin_site.register(Subject,SubjectAdmin)
admin_site.register(Resource, ResourceAdmin)