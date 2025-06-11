from channels.db import database_sync_to_async
from django.contrib.auth.models import AnonymousUser
from graphql_jwt.utils import get_payload, get_user_by_payload
import channels_graphql_ws

from .schema import schema


class GraphqlWsConsumer(channels_graphql_ws.GraphqlWsConsumer):
    """WebSocket consumer handling GraphQL subscriptions."""

    schema = schema

    async def on_connect(self, payload):
        token = payload.get("Authorization")
        if token and token.startswith("JWT "):
            try:
                payload_data = get_payload(token[4:])
                user = await database_sync_to_async(get_user_by_payload)(payload_data)
                self.scope["user"] = user or AnonymousUser()
            except Exception:  # invalid token
                self.scope["user"] = AnonymousUser()
        else:
            self.scope["user"] = AnonymousUser()
