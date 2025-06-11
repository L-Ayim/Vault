from graphene_file_upload.django import FileUploadGraphQLView

class NoSubscriptionGraphQLView(FileUploadGraphQLView):
    def __init__(self, *args, **kwargs):
        kwargs.setdefault('subscription_path', '')
        super().__init__(*args, **kwargs)
