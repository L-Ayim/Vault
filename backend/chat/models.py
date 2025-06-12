from django.conf import settings
from django.db import models
from django.utils import timezone

User = settings.AUTH_USER_MODEL


class Channel(models.Model):
    DIRECT = "DIRECT"
    NODE = "NODE"
    GROUP = "GROUP"
    PUBLIC = "PUBLIC"
    CHANNEL_TYPE_CHOICES = [
        (DIRECT, "Direct"),
        (NODE, "Node-linked"),
        (GROUP, "Group"),
        (PUBLIC, "Public"),
    ]

    name = models.CharField(max_length=100, blank=True)
    channel_type = models.CharField(max_length=10, choices=CHANNEL_TYPE_CHOICES)
    # For DIRECT: set direct_user1, direct_user2
    direct_user1 = models.ForeignKey(
        User,
        null=True,
        blank=True,
        related_name="direct_channels_as_1",
        on_delete=models.CASCADE,
    )
    direct_user2 = models.ForeignKey(
        User,
        null=True,
        blank=True,
        related_name="direct_channels_as_2",
        on_delete=models.CASCADE,
    )
    # For NODE-linked:
    node = models.ForeignKey(
        "graph.Node",
        null=True,
        blank=True,
        related_name="chat_channel",
        on_delete=models.CASCADE,
    )
    # For GROUP-linked:
    group = models.ForeignKey(
        "accounts.Group",
        null=True,
        blank=True,
        related_name="chat_channel",
        on_delete=models.CASCADE,
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = [
            ("direct_user1", "direct_user2"),
            ("node",),
            ("group",),
        ]

    def __str__(self):
        if self.channel_type == self.DIRECT:
            return f"DM {self.direct_user1_id}↔{self.direct_user2_id}"
        if self.channel_type == self.NODE:
            return f"NodeChannel#{self.node_id}"
        if self.channel_type == self.GROUP:
            return f"GroupChannel#{self.group_id}"
        return f"PublicChannel#{self.id}"


class ChannelMembership(models.Model):
    channel = models.ForeignKey(
        Channel, on_delete=models.CASCADE, related_name="memberships"
    )
    user = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name="chat_memberships"
    )
    joined_at = models.DateTimeField(auto_now_add=True)
    last_read_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        unique_together = (("channel", "user"),)

    def __str__(self):
        return f"{self.user_id} in channel {self.channel_id}"


class Message(models.Model):
    channel = models.ForeignKey(
        Channel, on_delete=models.CASCADE, related_name="messages"
    )
    sender = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name="sent_messages"
    )
    text = models.TextField(blank=True)
    attachment = models.ForeignKey(
        "files.Version",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="attached_messages",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"[{self.created_at}] {self.sender_id}→ch{self.channel_id}"
