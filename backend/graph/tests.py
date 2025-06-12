from django.test import TestCase
from types import SimpleNamespace
from django.contrib.auth import get_user_model

from accounts.models import Group, GroupMember
from .models import Node, NodeShare
from .schema import NodeType


class NodeShareResolverTests(TestCase):
    def setUp(self):
        User = get_user_model()
        self.owner = User.objects.create_user(username="owner", password="pw")
        self.other = User.objects.create_user(username="other", password="pw")
        self.node = Node.objects.create(owner=self.owner, name="n")
        self.group = Group.objects.create(name="g", owner=self.owner)

    def _info_for(self, user):
        return SimpleNamespace(context=SimpleNamespace(user=user))

    def test_group_member_can_resolve_shares(self):
        member = get_user_model().objects.create_user(username="member", password="pw")
        GroupMember.objects.create(user=member, group=self.group)

        s1 = NodeShare.objects.create(node=self.node, shared_with_group=self.group, permission=NodeShare.READ)
        s2 = NodeShare.objects.create(node=self.node, shared_with_user=self.other, permission=NodeShare.WRITE)

        shares = NodeType.resolve_shares(self.node, self._info_for(member))
        self.assertEqual(set(shares), {s1, s2})

    def test_public_user_can_resolve_shares(self):
        viewer = get_user_model().objects.create_user(username="viewer", password="pw")

        s1 = NodeShare.objects.create(node=self.node, is_public=True, permission=NodeShare.READ)
        s2 = NodeShare.objects.create(node=self.node, shared_with_user=self.other, permission=NodeShare.READ)

        shares = NodeType.resolve_shares(self.node, self._info_for(viewer))
        self.assertEqual(set(shares), {s1, s2})
