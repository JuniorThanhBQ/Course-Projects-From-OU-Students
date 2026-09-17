from rest_framework import permissions
from drf_yasg.views import get_schema_view
from drf_yasg import openapi

schema_view = get_schema_view(
    openapi.Info(
        title="LMS API",
        default_version='v1',
        description="APIs for Open University LMS",
        contact=openapi.Contact(email="2351050164thanh@ou.edu.vn"),
        license=openapi.License(name="Văn Trung Thành và Hồ Thị Ngọc Trinh"),
    ),
    public=True,
    permission_classes=(permissions.AllowAny,),
)