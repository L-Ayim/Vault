from django.db import migrations, models

class Migration(migrations.Migration):
    dependencies = [
        ('accounts', '0006_remove_profile_is_public'),
    ]

    operations = [
        migrations.AddField(
            model_name='profile',
            name='preferences',
            field=models.JSONField(default=dict, blank=True),
        ),
    ]
