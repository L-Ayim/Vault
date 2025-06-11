from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver

from .models import Node, NodeFile, NodeShare, Edge
from vault.subscriptions import NodeUpdates


@receiver(post_save, sender=Node)
@receiver(post_delete, sender=Node)
def broadcast_node_update(sender, instance, **kwargs):
    # Notify subscribers whenever a Node is created, updated, or deleted
    NodeUpdates.notify(instance.id)


@receiver(post_save, sender=NodeFile)
@receiver(post_delete, sender=NodeFile)
def broadcast_nodefile_update(sender, instance, **kwargs):
    """Notify subscribers when files are added to or removed from a node."""
    NodeUpdates.notify(instance.node_id)


@receiver(post_save, sender=NodeShare)
@receiver(post_delete, sender=NodeShare)
def broadcast_nodeshare_update(sender, instance, **kwargs):
    """Notify subscribers when node shares change."""
    NodeUpdates.notify(instance.node_id)


@receiver(post_save, sender=Edge)
@receiver(post_delete, sender=Edge)
def broadcast_edge_update(sender, instance, **kwargs):
    """Notify subscribers when edges are created or removed."""
    NodeUpdates.notify(instance.node_a_id)
    NodeUpdates.notify(instance.node_b_id)
