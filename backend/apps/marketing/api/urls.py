from django.urls import path
from .views import ads_grouped, public_settings, submit_lead, submit_review, my_requests, chat_reply, chat_history

urlpatterns = [
    path('', ads_grouped),
    path('settings/', public_settings),
    path('lead/', submit_lead),
    path('review/', submit_review),
    path('chat/', chat_reply),
    path('chat/history/', chat_history),
    path('my-requests/', my_requests),
]
