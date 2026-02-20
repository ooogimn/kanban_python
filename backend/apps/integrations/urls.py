from django.urls import path
from .views import google_sheets_export

urlpatterns = [
    path('google-sheets/export/', google_sheets_export),
]
