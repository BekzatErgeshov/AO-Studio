from django.db import migrations, models


class Migration(migrations.Migration):
    """У вопроса появились дополнительные принимаемые формулировки ответа."""

    dependencies = [
        ("rooms", "0007_saved_rooms"),
    ]

    operations = [
        migrations.AddField(
            model_name="question",
            name="alt_answers",
            field=models.JSONField(blank=True, default=list),
        ),
    ]
