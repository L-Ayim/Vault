# vault/urls.py

import os
from django.contrib import admin
from django.urls import path
from django.conf import settings
from django.conf.urls.static import static

from django.views.decorators.csrf import csrf_exempt
# Use the special GraphQL view that handles multipart/file uploads
from graphene_file_upload.django import FileUploadGraphQLView
from .views import NoSubscriptionGraphQLView

urlpatterns = [
    # Admin site
    path('admin/', admin.site.urls),

    # GraphQL endpoint (with GraphiQL UI and file‐upload support)
    # We wrap it in csrf_exempt so Altair/Electron (origin "electron://altair")
    # won’t be blocked by Django’s CSRF middleware.
    path(
        'graphql/',
        csrf_exempt(
            NoSubscriptionGraphQLView.as_view(graphiql=True)
        ),
        name='graphql',
    ),
]

if settings.DEBUG:
    # In debug mode, serve uploaded media files at MEDIA_URL
    urlpatterns += static(
        settings.MEDIA_URL,
        document_root=settings.MEDIA_ROOT,
    )

    # And serve static assets (CSS/JS) at STATIC_URL
    urlpatterns += static(
        settings.STATIC_URL,
        document_root=settings.STATIC_ROOT,
    )
