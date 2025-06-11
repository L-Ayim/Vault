# vault/schema.py

import graphene, graphql_jwt
from accounts.schema import AccountsQuery, AccountsMutation
from files.schema import FilesQuery, FilesMutation
from graph.schema import GraphQuery, GraphMutation
from chat.schema import ChatQuery, ChatMutation
from .subscriptions import NodeUpdates, MessageUpdates


class Query(
    AccountsQuery,
    FilesQuery,
    GraphQuery,
    ChatQuery,
    graphene.ObjectType,
):
    pass


class Mutation(
    AccountsMutation,
    FilesMutation,
    GraphMutation,
    ChatMutation,
    graphene.ObjectType,
):
    tokenAuth = graphql_jwt.ObtainJSONWebToken.Field()
    verifyToken = graphql_jwt.Verify.Field()
    refreshToken = graphql_jwt.Refresh.Field()


class Subscription(graphene.ObjectType):
    node_updates = NodeUpdates.Field()
    message_updates = MessageUpdates.Field()


schema = graphene.Schema(query=Query, mutation=Mutation, subscription=Subscription)
