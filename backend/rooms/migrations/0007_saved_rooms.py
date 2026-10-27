import django.db.models.deletion
from django.db import migrations, models


def reset_counts(apps, schema_editor):
    """Старое число было счётчиком лайков — к числу сохранений оно отношения не имеет."""
    apps.get_model("rooms", "AORoom").objects.update(saves_count=0)


class Migration(migrations.Migration):
    """Лайк заменён сохранением: сохранить комнату — значит сделать её личную копию."""

    dependencies = [
        ("rooms", "0006_timer_choices"),
    ]

    operations = [
        migrations.RenameField(
            model_name="aoroom",
            old_name="likes_count",
            new_name="saves_count",
        ),
        migrations.AddField(
            model_name="aoroom",
            name="saved_from",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="copies",
                to="rooms.aoroom",
            ),
        ),
        migrations.RunPython(reset_counts, migrations.RunPython.noop),
        migrations.RemoveConstraint(
            model_name="like",
            name="unique_like",
        ),
        migrations.DeleteModel(name="Like"),
    ]
