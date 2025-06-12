import uuid
from django.conf import settings
from django.db import models
from django.utils import timezone
from django.contrib.auth import get_user_model
from django.db.models.signals import post_save
from django.dispatch import receiver

User = get_user_model()

def generate_invite_code():
    """
    Used as the default generator for Invite.code (so migrations can import it).
    """
    return uuid.uuid4().hex


class Profile(models.Model):
    """Extended user info."""
    user       = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="profile"
    )
    avatar_file = models.ForeignKey(
        'files.File',
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='avatar_profiles',
    )
    avatar_url = models.URLField(blank=True)
    bio        = models.TextField(blank=True)

    def __str__(self):
        return f"Profile for {self.user.username}"


@receiver(post_save, sender=settings.AUTH_USER_MODEL)
def create_user_profile(sender, instance, created, **kwargs):
    """Automatically create a Profile when a new User is created."""
    if created:
        Profile.objects.create(user=instance)


class Invite(models.Model):
    """Friend‐invite codes (single‐use or multi‐use)."""
    SINGLE = 'SINGLE'
    MULTI  = 'MULTI'
    CODE_TYPE_CHOICES = [
        (SINGLE, 'Single use'),
        (MULTI,  'Multi use'),
    ]

    code        = models.CharField(
        max_length=32,
        unique=True,
        default=generate_invite_code
    )
    created_by  = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="sent_invites"
    )
    code_type   = models.CharField(
        max_length=6,
        choices=CODE_TYPE_CHOICES,
        default=SINGLE
    )
    max_uses    = models.PositiveIntegerField(
        null=True, blank=True,
        help_text="Max redemptions (ignored for SINGLE)"
    )
    uses_count  = models.PositiveIntegerField(default=0)
    expires_at  = models.DateTimeField(null=True, blank=True)
    is_revoked  = models.BooleanField(default=False)
    created_at  = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Invite {self.code} by {self.created_by.username}"

    @property
    def is_active(self):
        """True if code is not expired, not revoked, and under its use limit."""
        if self.is_revoked:
            return False
        if self.expires_at and self.expires_at <= timezone.now():
            return False
        if self.code_type == self.SINGLE and self.uses_count >= 1:
            return False
        if (self.code_type == self.MULTI
           and self.max_uses is not None
           and self.uses_count >= self.max_uses):
            return False
        return True


class Friendship(models.Model):
    """Mutual friendship (established when an invite is accepted)."""
    user     = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="friendships"
    )
    friend   = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="friends_of"
    )
    created  = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = (('user', 'friend'),)
        ordering = ['-created']

    def __str__(self):
        return f"{self.user.username} ↔ {self.friend.username}"


class Group(models.Model):
    """
    A sharing group. Users join via invite_code; can be single‐use or multi‐use,
    revocable, and carry metadata.
    """
    name        = models.CharField(max_length=100)
    owner       = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='owned_groups'
    )
    invite_code = models.UUIDField(
        default=uuid.uuid4,
        editable=False,
        unique=True
    )
    single_use  = models.BooleanField(
        default=False,
        help_text="If true, code expires after one use"
    )
    revoked     = models.BooleanField(
        default=False,
        help_text="Manually revoke this group's invite code"
    )
    max_invite_uses = models.PositiveIntegerField(
        default=100,
        help_text="Maximum times the current invite code can be used before rotation",
    )
    invite_uses_count = models.PositiveIntegerField(
        default=0,
        help_text="Number of times the current invite code has been used",
    )
    created_at  = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.name} (owner={self.owner.username})"

    def revoke(self):
        """Mark this group’s invite as revoked."""
        self.revoked = True
        self.save()

    def register_invite_use(self):
        """Increment usage and rotate code when limit reached."""
        self.invite_uses_count += 1
        if self.invite_uses_count >= self.max_invite_uses:
            self.invite_code = uuid.uuid4()
            self.invite_uses_count = 0
        self.save()

    @property
    def is_active(self):
        return not self.revoked and self.invite_uses_count < self.max_invite_uses


class GroupMember(models.Model):
    """
    A membership record linking a User to a Group.
    """
    user   = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='group_memberships'
    )
    group  = models.ForeignKey(
        Group,
        on_delete=models.CASCADE,
        related_name='members'
    )
    joined = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = (('user', 'group'),)
        ordering = ['-joined']

    def __str__(self):
        return f"{self.user.username} in {self.group.name}"
