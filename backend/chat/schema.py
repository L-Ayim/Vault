import graphene
from graphql import GraphQLError
from graphene_django import DjangoObjectType
from graphene_file_upload.scalars import Upload
from django.db.models import Q
from django.utils import timezone
from datetime import datetime

from .models import Channel, ChannelMembership, Message
from accounts.schema import UserType
from accounts.models import Group
from files.schema import VersionType
from graph.models import Node

# ── Types ────────────────────────────────────────────────────────────────────


class ChannelType(DjangoObjectType):
    unread_count = graphene.Int()
    direct_user1 = graphene.Field(UserType)
    direct_user2 = graphene.Field(UserType)

    class Meta:
        model = Channel
        fields = (
            "id",
            "name",
            "channel_type",
            "node",
            "group",
            "direct_user1",
            "direct_user2",
            "created_at",
        )

    def resolve_unread_count(self, info):
        user = info.context.user
        if user.is_anonymous:
            return 0
        membership = self.memberships.filter(user=user).first()
        if not membership:
            return 0
        last_read = membership.last_read_at
        if not last_read:
            last_read = timezone.make_aware(datetime.min)
        return (
            self.messages.filter(created_at__gt=last_read)
            .exclude(sender=user)
            .count()
        )


class MessageType(DjangoObjectType):
    sender = graphene.Field(UserType)
    attachment = graphene.Field(VersionType)

    class Meta:
        model = Message
        fields = ("id", "channel", "sender", "text", "attachment", "created_at")

    def resolve_sender(self, info):
        return self.sender

    def resolve_attachment(self, info):
        return self.attachment


# ── Queries ─────────────────────────────────────────────────────────────────


class ChatQuery(graphene.ObjectType):
    my_channels = graphene.List(ChannelType)
    channel_messages = graphene.List(
        MessageType,
        channel_id=graphene.ID(required=True),
        limit=graphene.Int(default_value=50),
        offset=graphene.Int(default_value=0),
    )

    def resolve_my_channels(self, info):
        user = info.context.user
        if user.is_anonymous:
            raise GraphQLError("Authentication required.")
        return Channel.objects.filter(memberships__user=user)

    def resolve_channel_messages(self, info, channel_id, limit, offset):
        user = info.context.user
        if user.is_anonymous:
            raise GraphQLError("Authentication required.")
        ch = Channel.objects.filter(pk=channel_id).first()
        if not ch or not ch.memberships.filter(user=user).exists():
            raise GraphQLError("No access to that channel.")
        return ch.messages.order_by("created_at")[offset : offset + limit]


# ── Mutations ────────────────────────────────────────────────────────────────


class CreateDirectChannel(graphene.Mutation):
    channel = graphene.Field(ChannelType)

    class Arguments:
        with_user_id = graphene.ID(required=True)

    def mutate(self, info, with_user_id):
        me = info.context.user
        if me.is_anonymous:
            raise GraphQLError("Authentication required.")
        # always store smaller→larger to satisfy unique_together
        u1, u2 = sorted([me.id, int(with_user_id)])
        ch, created = Channel.objects.get_or_create(
            direct_user1_id=u1, direct_user2_id=u2, channel_type=Channel.DIRECT
        )
        # ensure both members
        ChannelMembership.objects.get_or_create(
            channel=ch,
            user=me,
            defaults={"last_read_at": timezone.now()},
        )
        ChannelMembership.objects.get_or_create(
            channel=ch,
            user_id=with_user_id,
            defaults={"last_read_at": timezone.now()},
        )
        return CreateDirectChannel(channel=ch)


class JoinNodeChannel(graphene.Mutation):
    channel = graphene.Field(ChannelType)

    class Arguments:
        node_id = graphene.ID(required=True)

    def mutate(self, info, node_id):
        user = info.context.user
        if user.is_anonymous:
            raise GraphQLError("Authentication required.")
        # check READ access on Node
        node = Node.objects.filter(pk=node_id).first()
        if not node:
            raise GraphQLError("Node not found.")

        # reuse our Node-share logic
        from graph.schema import NodeType

        NodeType.resolve_shares
        NodeType.resolve_files

        # enforce membership by owner/shares
        can_read = (
            node.owner_id == user.id
            or node.shares.filter(
                Q(is_public=True, permission="R")
                | Q(shared_with_user=user)
                | Q(
                    shared_with_group__in=user.group_memberships.values_list(
                        "group", flat=True
                    )
                )
            ).exists()
        )
        if not can_read:
            raise GraphQLError("No read access on that node.")

        ch, _ = Channel.objects.get_or_create(channel_type=Channel.NODE, node=node)
        ChannelMembership.objects.get_or_create(
            channel=ch,
            user=user,
            defaults={"last_read_at": timezone.now()},
        )
        return JoinNodeChannel(channel=ch)


class JoinGroupChannel(graphene.Mutation):
    channel = graphene.Field(ChannelType)

    class Arguments:
        group_id = graphene.ID(required=True)

    def mutate(self, info, group_id):
        user = info.context.user
        if user.is_anonymous:
            raise GraphQLError("Authentication required.")
        grp = Group.objects.filter(pk=group_id, members__user=user).first()
        if not grp:
            raise GraphQLError("No access to that group.")
        ch, _ = Channel.objects.get_or_create(
            channel_type=Channel.GROUP,
            group=grp,
        )
        ChannelMembership.objects.get_or_create(
            channel=ch,
            user=user,
            defaults={"last_read_at": timezone.now()},
        )
        return JoinGroupChannel(channel=ch)


class SendMessage(graphene.Mutation):
    message = graphene.Field(MessageType)

    class Arguments:
        channel_id = graphene.ID(required=True)
        text = graphene.String()
        upload = Upload()

    def mutate(self, info, channel_id, text=None, upload=None):
        user = info.context.user
        if user.is_anonymous:
            raise GraphQLError("Authentication required.")
        ch = Channel.objects.filter(pk=channel_id).first()
        if not ch or not ch.memberships.filter(user=user).exists():
            raise GraphQLError("No access to that channel.")

        version = None
        if upload:
            # treat upload as a new Version in a File owned by user
            from files.models import File, Version

            f = File.objects.create(owner=user, name=upload.name, upload=upload)
            version = Version.objects.create(file=f, upload=upload)

        msg = Message.objects.create(
            channel=ch, sender=user, text=text or "", attachment=version
        )
        return SendMessage(message=msg)


class MarkChannelRead(graphene.Mutation):
    ok = graphene.Boolean()

    class Arguments:
        channel_id = graphene.ID(required=True)

    def mutate(self, info, channel_id):
        user = info.context.user
        if user.is_anonymous:
            raise GraphQLError("Authentication required.")
        membership = ChannelMembership.objects.filter(
            channel_id=channel_id, user=user
        ).first()
        if not membership:
            raise GraphQLError("No access to that channel.")
        membership.last_read_at = timezone.now()
        membership.save()
        return MarkChannelRead(ok=True)


class ChatMutation(graphene.ObjectType):
    create_direct_channel = CreateDirectChannel.Field()
    join_node_channel = JoinNodeChannel.Field()
    join_group_channel = JoinGroupChannel.Field()
    send_message = SendMessage.Field()
    mark_channel_read = MarkChannelRead.Field()


# Finally, wire up the schema
schema = graphene.Schema(query=ChatQuery, mutation=ChatMutation)
