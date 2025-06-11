from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver

from .models import Message
from vault.subscriptions import MessageUpdates


@receiver(post_save, sender=Message)
@receiver(post_delete, sender=Message)
def broadcast_message_update(sender, instance, **kwargs):
    """Notify subscribers when a chat message is created or deleted."""
    MessageUpdates.notify(instance.channel_id)

