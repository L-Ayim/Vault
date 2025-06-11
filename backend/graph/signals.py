from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver

from .models import Node
from vault.subscriptions import NodeUpdates


@receiver(post_save, sender=Node)
@receiver(post_delete, sender=Node)
def broadcast_node_update(sender, instance, **kwargs):
    # Notify subscribers whenever a Node is created, updated, or deleted
    NodeUpdates.notify(instance.id)
