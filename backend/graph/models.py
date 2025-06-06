from django.conf import settings
from django.db import models
from django.utils import timezone

User = settings.AUTH_USER_MODEL

class Node(models.Model):
    """A container of files, owned by a user."""
    name        = models.CharField(max_length=100)
    description = models.TextField(blank=True)
    owner       = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="nodes"
    )
    created_at  = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Node {self.id}: {self.name}"

class NodeFile(models.Model):
    """Join table: a File in a Node, with per-file notes."""
    node      = models.ForeignKey(
        Node,
        on_delete=models.CASCADE,
        related_name="node_files"
    )
    file      = models.ForeignKey(
        'files.File',
        on_delete=models.CASCADE,
        related_name="file_nodes"
    )
    note      = models.TextField(blank=True)
    added_at  = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("node", "file")

    def __str__(self):
        return f"NodeFile: node={self.node_id}, file={self.file_id}"

class Edge(models.Model):
    """An undirected connection between two nodes."""
    node_a     = models.ForeignKey(
        Node,
        on_delete=models.CASCADE,
        related_name="edges_as_a"
    )
    node_b     = models.ForeignKey(
        Node,
        on_delete=models.CASCADE,
        related_name="edges_as_b"
    )
    label      = models.CharField(max_length=100, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = (("node_a", "node_b"), ("node_b", "node_a"))

    def __str__(self):
        return f"Edge {self.id}: {self.node_a_id} ↔ {self.node_b_id}"

class NodeShare(models.Model):
    """Grants read/write access to a Node."""
    READ  = "R"
    WRITE = "W"
    PERMISSION_CHOICES = [
        (READ, "Read"),
        (WRITE, "Write"),
    ]

    node               = models.ForeignKey(
        Node,
        on_delete=models.CASCADE,
        related_name="shares"
    )
    shared_with_user   = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.CASCADE,
        related_name="shared_nodes"
    )
    shared_with_group  = models.ForeignKey(
        "accounts.Group",
        null=True,
        blank=True,
        on_delete=models.CASCADE,
        related_name="shared_nodes"
    )
    is_public          = models.BooleanField(default=False)
    permission         = models.CharField(
        max_length=1,
        choices=PERMISSION_CHOICES,
        default=READ
    )
    created_at         = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = (
            ("node", "shared_with_user"),
            ("node", "shared_with_group"),
        )

    def __str__(self):
        target = "public" if self.is_public else (
            f"user={self.shared_with_user_id}" if self.shared_with_user else f"group={self.shared_with_group_id}"
        )
        return f"NodeShare(node={self.node_id}, to={target}, perm={self.permission})"
