from django.conf import settings
from django.db import models

User = settings.AUTH_USER_MODEL

class File(models.Model):
    owner      = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="files"
    )
    name       = models.CharField(max_length=255)
    upload     = models.FileField(
        upload_to='uploads/%Y/%m/%d/',
        max_length=500
    )
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.name} (#{self.id})"


class Version(models.Model):
    file       = models.ForeignKey(
        File,
        on_delete=models.CASCADE,
        related_name="versions"
    )
    upload     = models.FileField(
        upload_to='uploads/%Y/%m/%d/versions/',
        max_length=500
    )
    note       = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Version #{self.id} of File #{self.file_id}"


class FileShare(models.Model):
    READ  = "R"
    WRITE = "W"
    PERMISSION_CHOICES = [
        (READ, "Read"),
        (WRITE, "Write"),
    ]

    file              = models.ForeignKey(
        File,
        on_delete=models.CASCADE,
        related_name="shares"
    )
    shared_with_user  = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True, blank=True,
        on_delete=models.CASCADE,
        related_name="shared_files"
    )
    shared_with_group = models.ForeignKey(
        "accounts.Group",
        null=True, blank=True,
        on_delete=models.CASCADE,
        related_name="shared_files"
    )
    is_public         = models.BooleanField(default=False)
    permission        = models.CharField(
        max_length=1,
        choices=PERMISSION_CHOICES,
        default=READ
    )
    created_at        = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = (
            ("file", "shared_with_user"),
            ("file", "shared_with_group"),
        )

    def __str__(self):
        if self.is_public:
            target = "public"
        elif self.shared_with_user:
            target = f"user={self.shared_with_user_id}"
        else:
            target = f"group={self.shared_with_group_id}"
        return f"Share(file={self.file_id},to={target},perm={self.permission})"
