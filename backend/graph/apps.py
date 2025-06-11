from django.apps import AppConfig


class GraphConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "graph"

    def ready(self):
        # Import signal handlers to enable subscription broadcasts
        from . import signals  # noqa: F401
