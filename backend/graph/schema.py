import graphene
from graphql import GraphQLError
from graphene_django import DjangoObjectType
from django.db.models import Q

from .models import Node, NodeFile, Edge, NodeShare
from accounts.schema import UserType
from files.schema import FileType
from accounts.models import Group

# ── Types ────────────────────────────────────────────────────────────────────

class NodeFileType(DjangoObjectType):
    class Meta:
        model = NodeFile
        fields = ("note", "added_at", "file")


class EdgeType(DjangoObjectType):
    class Meta:
        model = Edge
        fields = ("id", "node_a", "node_b", "label", "created_at")


class NodeShareType(DjangoObjectType):
    class Meta:
        model = NodeShare
        fields = "__all__"


class NodeType(DjangoObjectType):
    owner  = graphene.Field(UserType)
    files  = graphene.List(NodeFileType)
    edges  = graphene.List(EdgeType)
    shares = graphene.List(NodeShareType)

    class Meta:
        model  = Node
        fields = ("id", "name", "description", "created_at", "owner", "files", "edges", "shares")

    def resolve_owner(self, info):
        return self.owner

    def resolve_files(self, info):
        return self.node_files.select_related("file").all()

    def resolve_edges(self, info):
        return Edge.objects.filter(Q(node_a=self) | Q(node_b=self))

    def resolve_shares(self, info):
        user = info.context.user
        if user.is_anonymous:
            raise GraphQLError("Authentication required.")

        # Owner always allowed
        if self.owner_id == user.id:
            return NodeShare.objects.filter(node=self)

        group_ids = user.group_memberships.values_list("group", flat=True)

        # Check for any READ/WRITE share granted via user, group, or public
        has_access = NodeShare.objects.filter(
            node=self,
            permission__in=[NodeShare.READ, NodeShare.WRITE],
        ).filter(
            Q(shared_with_user=user)
            | Q(shared_with_group__in=group_ids)
            | Q(is_public=True)
        ).exists()

        if not has_access:
            raise GraphQLError("Permission denied.")

        # Access confirmed → return all shares on the node
        return NodeShare.objects.filter(node=self)

# ── Queries ──────────────────────────────────────────────────────────────────

class GraphQuery(graphene.ObjectType):
    ping         = graphene.String()
    my_nodes     = graphene.List(
        NodeType,
        limit=graphene.Int(default_value=20),
        offset=graphene.Int(default_value=0),
        name_contains=graphene.String(),
    )
    node_files   = graphene.List(
        NodeFileType,
        node_id=graphene.ID(required=True),
        limit=graphene.Int(default_value=20),
        offset=graphene.Int(default_value=0),
    )
    node_edges   = graphene.List(
        EdgeType,
        node_id=graphene.ID(required=True),
        limit=graphene.Int(default_value=20),
        offset=graphene.Int(default_value=0),
    )
    public_nodes = graphene.List(
        NodeType,
        limit=graphene.Int(default_value=20),
        offset=graphene.Int(default_value=0),
    )

    def resolve_ping(self, info):
        return "pong"

    def resolve_my_nodes(self, info, limit, offset, name_contains=None):
        user = info.context.user
        if user.is_anonymous:
            raise GraphQLError("Authentication required.")

        # Allow both READ and WRITE permissions
        allowed_perms = [NodeShare.READ, NodeShare.WRITE]
        groups = user.group_memberships.values_list("group", flat=True)

        qs = Node.objects.filter(
            Q(owner=user)
            | Q(shares__is_public=True, shares__permission__in=allowed_perms)
            | Q(shares__shared_with_user=user, shares__permission__in=allowed_perms)
            | Q(shares__shared_with_group__in=groups, shares__permission__in=allowed_perms)
        ).distinct()

        if name_contains:
            qs = qs.filter(name__icontains=name_contains)

        return qs[offset : offset + limit]

    def resolve_node_files(self, info, node_id, limit, offset):
        node = Node.objects.filter(pk=node_id).first()
        if not node:
            raise GraphQLError("Node not found.")
        qs = node.node_files.select_related("file").all()
        return qs[offset : offset + limit]

    def resolve_node_edges(self, info, node_id, limit, offset):
        node = Node.objects.filter(pk=node_id).first()
        if not node:
            raise GraphQLError("Node not found.")
        qs = Edge.objects.filter(Q(node_a=node) | Q(node_b=node))
        return qs[offset : offset + limit]

    def resolve_public_nodes(self, info, limit, offset):
        qs = Node.objects.filter(
            shares__is_public=True, shares__permission=NodeShare.READ
        ).distinct()
        return qs[offset : offset + limit]


# ── Mutations ────────────────────────────────────────────────────────────────

class CreateNode(graphene.Mutation):
    node = graphene.Field(NodeType)

    class Arguments:
        name        = graphene.String(required=True)
        description = graphene.String()

    def mutate(self, info, name, description=""):
        user = info.context.user
        if user.is_anonymous:
            raise GraphQLError("Authentication required.")
        node = Node.objects.create(owner=user, name=name, description=description)
        return CreateNode(node=node)


class RenameNode(graphene.Mutation):
    node = graphene.Field(NodeType)

    class Arguments:
        node_id     = graphene.ID(required=True)
        name        = graphene.String()
        description = graphene.String()

    def mutate(self, info, node_id, name=None, description=None):
        user = info.context.user
        node = Node.objects.filter(pk=node_id, owner=user).first()
        if not node:
            raise GraphQLError("Only owner can rename node.")
        if name is not None:
            node.name = name
        if description is not None:
            node.description = description
        node.save()
        return RenameNode(node=node)


class DeleteNode(graphene.Mutation):
    ok = graphene.Boolean()

    class Arguments:
        node_id = graphene.ID(required=True)

    def mutate(self, info, node_id):
        user = info.context.user
        node = Node.objects.filter(pk=node_id, owner=user).first()
        if not node:
            raise GraphQLError("Only owner can delete node.")
        node.delete()
        return DeleteNode(ok=True)


class AddFileToNode(graphene.Mutation):
    node_file = graphene.Field(NodeFileType)

    class Arguments:
        node_id = graphene.ID(required=True)
        file_id = graphene.ID(required=True)
        note    = graphene.String()

    def mutate(self, info, node_id, file_id, note=""):
        user = info.context.user
        node = Node.objects.filter(pk=node_id, owner=user).first()
        if not node:
            raise GraphQLError("Permission denied.")
        nf, _ = NodeFile.objects.update_or_create(
            node=node,
            file_id=file_id,
            defaults={"note": note},
        )
        return AddFileToNode(node_file=nf)


class RemoveFileFromNode(graphene.Mutation):
    ok = graphene.Boolean()

    class Arguments:
        node_id = graphene.ID(required=True)
        file_id = graphene.ID(required=True)

    def mutate(self, info, node_id, file_id):
        user = info.context.user
        nf = NodeFile.objects.filter(
            node_id=node_id, file_id=file_id, node__owner=user
        ).first()
        if not nf:
            raise GraphQLError("Permission denied or not found.")
        nf.delete()
        return RemoveFileFromNode(ok=True)


class MoveFileBetweenNodes(graphene.Mutation):
    ok = graphene.Boolean()

    class Arguments:
        from_node = graphene.ID(required=True)
        to_node   = graphene.ID(required=True)
        file_id   = graphene.ID(required=True)

    def mutate(self, info, from_node, to_node, file_id):
        user = info.context.user
        rf = NodeFile.objects.filter(
            node_id=from_node, file_id=file_id, node__owner=user
        ).first()
        if not rf:
            raise GraphQLError("Permission denied on source.")
        rf.node_id = to_node
        rf.save()
        return MoveFileBetweenNodes(ok=True)


class CreateEdge(graphene.Mutation):
    edge = graphene.Field(EdgeType)

    class Arguments:
        node_a_id = graphene.ID(required=True)
        node_b_id = graphene.ID(required=True)
        label     = graphene.String()

    def mutate(self, info, node_a_id, node_b_id, label=""):
        user = info.context.user
        nodes = Node.objects.filter(pk__in=[node_a_id, node_b_id], owner=user)
        if nodes.count() != 2:
            raise GraphQLError("Permission denied.")
        edge, _ = Edge.objects.get_or_create(
            node_a_id=min(node_a_id, node_b_id),
            node_b_id=max(node_a_id, node_b_id),
            defaults={"label": label},
        )
        return CreateEdge(edge=edge)


class DeleteEdge(graphene.Mutation):
    ok = graphene.Boolean()

    class Arguments:
        edge_id = graphene.ID(required=True)

    def mutate(self, info, edge_id):
        user = info.context.user
        edge = Edge.objects.filter(pk=edge_id).first()
        if not edge or edge.node_a.owner_id != user.id or edge.node_b.owner_id != user.id:
            raise GraphQLError("Permission denied.")
        edge.delete()
        return DeleteEdge(ok=True)


class ShareNodeWithUser(graphene.Mutation):
    share = graphene.Field(NodeShareType)

    class Arguments:
        node_id    = graphene.ID(required=True)
        user_id    = graphene.ID(required=True)
        permission = graphene.String(required=True)

    def mutate(self, info, node_id, user_id, permission):
        user = info.context.user
        node = Node.objects.filter(pk=node_id, owner=user).first()
        if not node:
            raise GraphQLError("Only owner can share.")
        share, _ = NodeShare.objects.update_or_create(
            node=node,
            shared_with_user_id=user_id,
            defaults={"permission": permission, "is_public": False},
        )
        return ShareNodeWithUser(share=share)


class ShareNodeWithGroup(graphene.Mutation):
    share = graphene.Field(NodeShareType)

    class Arguments:
        node_id    = graphene.ID(required=True)
        group_id   = graphene.ID(required=True)
        permission = graphene.String(required=True)

    def mutate(self, info, node_id, group_id, permission):
        user = info.context.user
        node = Node.objects.filter(pk=node_id, owner=user).first()
        if not node:
            raise GraphQLError("Only owner can share.")
        share, _ = NodeShare.objects.update_or_create(
            node=node,
            shared_with_group_id=group_id,
            defaults={
                "permission": permission,
                "is_public": False,
                "shared_with_user": None,
            },
        )
        return ShareNodeWithGroup(share=share)


class MakeNodePublic(graphene.Mutation):
    share = graphene.Field(NodeShareType)

    class Arguments:
        node_id    = graphene.ID(required=True)
        permission = graphene.String(required=False, default_value=NodeShare.READ)

    def mutate(self, info, node_id, permission=NodeShare.READ):
        user = info.context.user
        node = Node.objects.filter(pk=node_id, owner=user).first()
        if not node:
            raise GraphQLError("Only owner can share.")
        share, _ = NodeShare.objects.update_or_create(
            node=node,
            is_public=True,
            defaults={
                "permission": permission,
                "shared_with_user": None,
                "shared_with_group": None,
            },
        )
        return MakeNodePublic(share=share)


class UpdateNodeShare(graphene.Mutation):
    share = graphene.Field(NodeShareType)

    class Arguments:
        share_id   = graphene.ID(required=True)
        permission = graphene.String(required=True)

    def mutate(self, info, share_id, permission):
        user = info.context.user
        share = NodeShare.objects.filter(pk=share_id, node__owner=user).first()
        if not share:
            raise GraphQLError("Share not found or you are not the owner.")
        share.permission = permission
        share.save()
        return UpdateNodeShare(share=share)


class RevokeNodeShare(graphene.Mutation):
    ok = graphene.Boolean()

    class Arguments:
        share_id = graphene.ID(required=True)

    def mutate(self, info, share_id):
        user = info.context.user
        share = NodeShare.objects.filter(pk=share_id, node__owner=user).first()
        if not share:
            raise GraphQLError("Share not found or you are not the owner.")
        share.delete()
        return RevokeNodeShare(ok=True)


# ── Root Mutation Container ──────────────────────────────────────────────────

class GraphMutation(graphene.ObjectType):
    createNode          = CreateNode.Field()
    renameNode          = RenameNode.Field()
    deleteNode          = DeleteNode.Field()
    addFileToNode       = AddFileToNode.Field()
    removeFileFromNode  = RemoveFileFromNode.Field()
    moveFileBetweenNodes= MoveFileBetweenNodes.Field()
    createEdge          = CreateEdge.Field()
    deleteEdge          = DeleteEdge.Field()
    shareNodeWithUser   = ShareNodeWithUser.Field()
    shareNodeWithGroup  = ShareNodeWithGroup.Field()
    makeNodePublic      = MakeNodePublic.Field()
    updateNodeShare     = UpdateNodeShare.Field()
    revokeNodeShare     = RevokeNodeShare.Field()

    # no-op field to keep schema happy
    noop = graphene.Boolean()

    def resolve_noop(self, info):
        return True


schema = graphene.Schema(query=GraphQuery, mutation=GraphMutation)
