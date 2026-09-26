from ckeditor_uploader.widgets import CKEditorUploadingWidget
from django.contrib import admin
from django.db.models import Count
from django.template.response import TemplateResponse
from django.utils.safestring import mark_safe

from courses.models import Category, Course, Lesson

from django import forms
from ckeditor_uploader.widgets import CKEditorUploadingWidget
from django.urls import path

class LessonForm(forms.ModelForm):
    content = forms.CharField(widget=CKEditorUploadingWidget)

    class Meta:
        model = Lesson
        fields = '__all__'

class CourseAdmin(admin.ModelAdmin):
    list_display = ['id','subject','created_date','active']
    search_fields = ['subject']
    list_filter = ['id','subject','created_date']
    readonly_fields = ['image_view']

    def image_view(self, course):
        if course.image:
            return mark_safe(f'<img src="/static/{course.image.name}" width="200" />')

    class Media:
        css = {
            'all': ('/static/css/styles.css',)
        }

class LessonAdmin(admin.ModelAdmin):
    form = LessonForm

class MyAdminSite(admin.AdminSite):
    site_header = "eCourse App"

    def get_urls(self):
        return [path('stats-view/', self.stats_view)] + super().get_urls()

    def stats_view(self, request):
        stats = Category.objects.annotate(count=Count('course')).values('id','name','count')
        count = Course.objects.filter(active=True).count()

        return TemplateResponse(request, 'admin/stats.html', {'stats': stats, 'course_count': count})

admin_site = MyAdminSite(name='myCourseApp')

admin_site.register(Category)
admin_site.register(Course, CourseAdmin)
admin_site.register(Lesson, CourseAdmin)
# Register your models here.
