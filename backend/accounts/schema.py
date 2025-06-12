import graphene
from django.utils import timezone
from graphql import GraphQLError
from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from graphene_django.types import DjangoObjectType

# NEW → helper that builds a proper dict payload for JWT
from graphql_jwt.shortcuts import get_token

from .models import Profile, Invite, Friendship, Group, GroupMember
from files.models import File

User = get_user_model()

# ─── GraphQL Types ─────────────────────────────────────────────────────────

class ProfileType(DjangoObjectType):
    avatar_url = graphene.String()

    class Meta:
        model = Profile
        fields = ("avatar_url", "bio", "is_public")

    def resolve_avatar_url(self, info):
        if self.avatar_file:
            return info.context.build_absolute_uri(self.avatar_file.upload.url)
        return self.avatar_url


class UserType(DjangoObjectType):
    class Meta:
        model = User
        fields = ("id", "username", "email", "profile")


class InviteType(DjangoObjectType):
    class Meta:
        model = Invite
        fields = (
            "code",
            "created_by",
            "code_type",
            "max_uses",
            "uses_count",
            "expires_at",
            "is_revoked",
            "created_at",
        )


class FriendshipType(DjangoObjectType):
    class Meta:
        model = Friendship
        fields = ("user", "friend", "created")


class GroupType(DjangoObjectType):
    class Meta:
        model = Group
        fields = (
            "id",
            "name",
            "owner",
            "invite_code",
            "single_use",
            "max_invite_uses",
            "invite_uses_count",
        )


# ─── Queries ────────────────────────────────────────────────────────────────

class AccountsQuery(graphene.ObjectType):
    me = graphene.Field(UserType)
    incoming_requests = graphene.List(
        InviteType, description="Invites I can redeem"
    )

    friends = graphene.List(
        UserType,
        limit=graphene.Int(default_value=20),
        offset=graphene.Int(default_value=0),
        username_contains=graphene.String(),
        description="My accepted friends",
    )

    my_groups = graphene.List(
        GroupType,
        limit=graphene.Int(default_value=20),
        offset=graphene.Int(default_value=0),
        name_contains=graphene.String(),
        description="Groups I belong to",
    )

    group_members = graphene.List(
        UserType,
        group_id=graphene.ID(required=True),
        description="Members of a group",
    )

    def resolve_me(self, info):
        user = info.context.user
        if user.is_anonymous:
            raise GraphQLError("Not logged in.")
        return user

    def resolve_incoming_requests(self, info):
        user = info.context.user
        if user.is_anonymous:
            raise GraphQLError("Not logged in.")
        return Invite.objects.filter(
            is_revoked=False, expires_at__gt=timezone.now()
        )

    def resolve_friends(self, info, limit, offset, username_contains=None):
        user = info.context.user
        if user.is_anonymous:
            raise GraphQLError("Not logged in.")
        sent = Friendship.objects.filter(user=user).values_list(
            "friend", flat=True
        )
        recv = Friendship.objects.filter(friend=user).values_list(
            "user", flat=True
        )
        qs = User.objects.filter(id__in=set(sent) | set(recv))
        if username_contains:
            qs = qs.filter(username__icontains=username_contains)
        return qs[offset : offset + limit]

    def resolve_my_groups(self, info, limit, offset, name_contains=None):
        user = info.context.user
        if user.is_anonymous:
            raise GraphQLError("Not logged in.")
        qs = Group.objects.filter(members__user=user).distinct()
        if name_contains:
            qs = qs.filter(name__icontains=name_contains)
        return qs[offset : offset + limit]

    def resolve_group_members(self, info, group_id):
        user = info.context.user
        if user.is_anonymous:
            raise GraphQLError("Not logged in.")
        grp = Group.objects.filter(pk=group_id, members__user=user).first()
        if not grp:
            raise GraphQLError("No access to this group.")
        return User.objects.filter(groupmember__group=grp)


# ─── Mutations ──────────────────────────────────────────────────────────────

class CreateUser(graphene.Mutation):
    """
    Register a new user and return a JWT.
    """

    user = graphene.Field(UserType)
    token = graphene.String()

    class Arguments:
        username = graphene.String(required=True)
        email = graphene.String(required=True)
        password = graphene.String(required=True)

    def mutate(self, info, username, email, password):
        if User.objects.filter(username=username).exists():
            raise GraphQLError("Username already taken.")
        try:
            validate_password(password)
        except Exception as e:
            raise GraphQLError(f"Password error: {e}")

        user = User.objects.create_user(
            username=username,
            email=email,
            password=password,
        )

        # FIX → build a valid dict payload and sign it
        token = get_token(user)

        return CreateUser(user=user, token=token)


class CreateFriendInvite(graphene.Mutation):
    invite = graphene.Field(InviteType)

    class Arguments:
        code_type = graphene.String(required=True, description="SINGLE or MULTI")
        max_uses = graphene.Int()
        expires_at = graphene.DateTime()

    def mutate(self, info, code_type, max_uses=None, expires_at=None):
        user = info.context.user
        if user.is_anonymous:
            raise GraphQLError("Login required.")
        if code_type not in (Invite.SINGLE, Invite.MULTI):
            raise GraphQLError("Invalid code_type.")
        invite = Invite.objects.create(
            created_by=user,
            code_type=code_type,
            max_uses=max_uses if code_type == Invite.MULTI else None,
            expires_at=expires_at,
        )
        return CreateFriendInvite(invite=invite)


class RedeemFriendInvite(graphene.Mutation):
    friend = graphene.Field(UserType)

    class Arguments:
        code = graphene.String(required=True)

    def mutate(self, info, code):
        user = info.context.user
        if user.is_anonymous:
            raise GraphQLError("Login required.")
        try:
            inv = Invite.objects.get(code=code)
        except Invite.DoesNotExist:
            raise GraphQLError("Invalid code.")
        if not inv.is_active:
            raise GraphQLError("Code expired or revoked.")
        inv.uses_count += 1
        inv.save()
        Friendship.objects.get_or_create(user=inv.created_by, friend=user)
        Friendship.objects.get_or_create(user=user, friend=inv.created_by)
        return RedeemFriendInvite(friend=inv.created_by)


class RevokeFriendInvite(graphene.Mutation):
    ok = graphene.Boolean()

    class Arguments:
        code = graphene.String(required=True)

    def mutate(self, info, code):
        user = info.context.user
        if user.is_anonymous:
            raise GraphQLError("Login required.")
        inv = Invite.objects.filter(code=code, created_by=user).first()
        if not inv:
            raise GraphQLError("Invite not found.")
        inv.is_revoked = True
        inv.save()
        return RevokeFriendInvite(ok=True)


class CreateGroup(graphene.Mutation):
    group = graphene.Field(GroupType)

    class Arguments:
        name = graphene.String(required=True)
        single_use = graphene.Boolean(default_value=False)
        max_invite_uses = graphene.Int(default_value=100)

    def mutate(self, info, name, single_use, max_invite_uses):
        user = info.context.user
        if user.is_anonymous:
            raise GraphQLError("Login required.")
        grp = Group.objects.create(
            name=name,
            owner=user,
            single_use=single_use,
            max_invite_uses=max_invite_uses,
        )
        GroupMember.objects.create(user=user, group=grp)
        return CreateGroup(group=grp)


class JoinGroupByInvite(graphene.Mutation):
    group = graphene.Field(GroupType)

    class Arguments:
        invite_code = graphene.UUID(required=True)

    def mutate(self, info, invite_code):
        user = info.context.user
        if user.is_anonymous:
            raise GraphQLError("Login required.")
        grp = Group.objects.filter(invite_code=invite_code, revoked=False).first()
        if not grp or not grp.is_active:
            raise GraphQLError("Invalid or revoked invite code.")
        GroupMember.objects.get_or_create(user=user, group=grp)
        grp.register_invite_use()
        if grp.single_use:
            grp.revoked = True
            grp.save()
        return JoinGroupByInvite(group=grp)


class UpdateProfile(graphene.Mutation):
    """Update the authenticated user's profile fields."""

    profile = graphene.Field(ProfileType)

    class Arguments:
        avatar_url = graphene.String()
        avatar_file_id = graphene.ID()
        bio = graphene.String()
        is_public = graphene.Boolean()

    def mutate(self, info, avatar_url=None, avatar_file_id=None, bio=None, is_public=None):
        user = info.context.user
        if user.is_anonymous:
            raise GraphQLError("Login required.")
        profile = user.profile
        if avatar_url is not None:
            profile.avatar_url = avatar_url
            profile.avatar_file = None
        if avatar_file_id is not None:
            file_obj = File.objects.filter(pk=avatar_file_id, owner=user).first()
            if not file_obj:
                raise GraphQLError("Invalid avatar file.")
            profile.avatar_file = file_obj
            profile.avatar_url = info.context.build_absolute_uri(file_obj.upload.url)
        if bio is not None:
            profile.bio = bio
        if is_public is not None:
            profile.is_public = is_public
        profile.save()
        return UpdateProfile(profile=profile)


class AccountsMutation(graphene.ObjectType):
    create_user          = CreateUser.Field()
    create_friend_invite = CreateFriendInvite.Field()
    redeem_friend_invite = RedeemFriendInvite.Field()
    revoke_friend_invite = RevokeFriendInvite.Field()
    create_group         = CreateGroup.Field()
    join_group_by_invite = JoinGroupByInvite.Field()
    update_profile       = UpdateProfile.Field()
