# Generated by Django 4.2.23 on 2025-06-12 10:25

from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("files", "0002_alter_file_upload_alter_version_upload_fileshare"),
        ("accounts", "0004_add_invite_use_fields"),
    ]

    operations = [
        migrations.AddField(
            model_name="profile",
            name="avatar_file",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="avatar_profiles",
                to="files.file",
            ),
        ),
    ]
