from django.urls import path
from .views import ads_grouped

urlpatterns = [
    path('', ads_grouped),
]
