from django.db import migrations

class Migration(migrations.Migration):
    dependencies = [
        ("accounts", "0005_profile_avatar_file"),
    ]

    operations = [
        migrations.RemoveField(
            model_name="profile",
            name="is_public",
        ),
    ]
