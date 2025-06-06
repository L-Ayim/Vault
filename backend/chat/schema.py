import graphene
from graphql import GraphQLError
from graphene_django import DjangoObjectType
from graphene_file_upload.scalars import Upload
from django.db.models import Q

from .models import Channel, ChannelMembership, Message
from accounts.schema import UserType
from files.schema    import VersionType
from graph.models    import Node

# ── Types ────────────────────────────────────────────────────────────────────

class ChannelType(DjangoObjectType):
    class Meta:
        model  = Channel
        fields = ("id", "name", "channel_type", "node", "created_at")


class MessageType(DjangoObjectType):
    sender     = graphene.Field(UserType)
    attachment = graphene.Field(VersionType)

    class Meta:
        model  = Message
        fields = ("id", "channel", "sender", "text", "attachment", "created_at")

    def resolve_sender(self, info):
        return self.sender

    def resolve_attachment(self, info):
        return self.attachment


# ── Queries ─────────────────────────────────────────────────────────────────

class ChatQuery(graphene.ObjectType):
    my_channels      = graphene.List(ChannelType)
    channel_messages = graphene.List(
        MessageType,
        channel_id=graphene.ID(required=True),
        limit=graphene.Int(default_value=50),
        offset=graphene.Int(default_value=0)
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
        return ch.messages.order_by("created_at")[offset:offset+limit]


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
            direct_user1_id=u1,
            direct_user2_id=u2,
            channel_type=Channel.DIRECT
        )
        # ensure both members
        ChannelMembership.objects.get_or_create(channel=ch, user=me)
        ChannelMembership.objects.get_or_create(channel=ch, user_id=with_user_id)
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
        # reuse our Node-share logic:
        from graph.schema import NodeType
        NodeType.resolve_shares  # just import
        NodeType.resolve_files   # ...
        # Here we just enforce membership by owner/shares:
        from .schema import GraphQuery
        can_read = node.owner_id == user.id or node.shares.filter(
            Q(is_public=True, permission='R') |
            Q(shared_with_user=user) |
            Q(shared_with_group__in=user.group_memberships.values_list("group",flat=True))
        ).exists()
        if not can_read:
            raise GraphQLError("No read access on that node.")
        ch, _ = Channel.objects.get_or_create(
            channel_type=Channel.NODE,
            node=node
        )
        ChannelMembership.objects.get_or_create(channel=ch, user=user)
        return JoinNodeChannel(channel=ch)


class SendMessage(graphene.Mutation):
    message = graphene.Field(MessageType)

    class Arguments:
        channel_id = graphene.ID(required=True)
        text       = graphene.String()
        upload     = Upload()

    def mutate(self, info, channel_id, text=None, upload=None):
        user = info.context.user
        if user.is_anonymous:
            raise GraphQLError("Authentication required.")
        ch = Channel.objects.filter(pk=channel_id).first()
        if not ch or not ch.memberships.filter(user=user).exists():
            raise GraphQLError("No access to that channel.")
        version = None
        if upload:
            # treat upload as a brand-new Version in a File owned by user
            from files.models import File, Version
            f = File.objects.create(owner=user, name=upload.name, upload=upload)
            version = Version.objects.create(file=f, upload=upload)
        msg = Message.objects.create(
            channel=ch,
            sender=user,
            text=text or "",
            attachment=version
        )
        return SendMessage(message=msg)


class ChatMutation(graphene.ObjectType):
    create_direct_channel = CreateDirectChannel.Field()
    join_node_channel     = JoinNodeChannel.Field()
    send_message          = SendMessage.Field()
