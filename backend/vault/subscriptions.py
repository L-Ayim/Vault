import graphene
import channels_graphql_ws
from asgiref.sync import async_to_sync


class NodeUpdates(channels_graphql_ws.Subscription):
    """Broadcast node update events."""

    id = graphene.ID()
    node_id = graphene.ID(required=False)

    class Arguments:
        node_id = graphene.ID(required=False)

    @staticmethod
    def subscribe(root, info, node_id=None):
        group = f"node_{node_id}" if node_id else "nodes"
        return [group]

    @staticmethod
    def publish(payload, info, node_id=None):
        return NodeUpdates(id=payload.get("id"))

    @classmethod
    def notify(cls, node_id):
        async_to_sync(cls.broadcast)(group="nodes", payload={"id": str(node_id)})
        async_to_sync(cls.broadcast)(
            group=f"node_{node_id}", payload={"id": str(node_id)}
        )
