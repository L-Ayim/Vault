# vault/urls.py

import os
from django.contrib import admin
from django.urls import path, re_path
from django.conf import settings
from django.conf.urls.static import static

from django.views.generic import TemplateView

from django.views.decorators.csrf import csrf_exempt
# Use the special GraphQL view that handles multipart/file uploads
from graphene_file_upload.django import FileUploadGraphQLView
from graphql_jwt.decorators import jwt_cookie

urlpatterns = [
    # Admin site
    path('admin/', admin.site.urls),

    # GraphQL endpoint (with GraphiQL UI and file‐upload support)
    # We wrap it in csrf_exempt so Altair/Electron (origin "electron://altair")
    # won’t be blocked by Django’s CSRF middleware.
    path(
        'graphql/',
        csrf_exempt(
            jwt_cookie(
                FileUploadGraphQLView.as_view(graphiql=True)
            )
        ),
        name='graphql',
    ),
]

# Catch-all: serve React app for any route not handled above
urlpatterns += [
    re_path(r'^(?!admin/|graphql/).*', TemplateView.as_view(template_name='index.html'), name='index'),
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
