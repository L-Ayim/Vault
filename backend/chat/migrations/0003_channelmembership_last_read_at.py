from django.db import migrations, models

class Migration(migrations.Migration):
    dependencies = [
        ('chat', '0002_add_group_channel'),
    ]

    operations = [
        migrations.AddField(
            model_name='channelmembership',
            name='last_read_at',
            field=models.DateTimeField(null=True, blank=True),
        ),
    ]
