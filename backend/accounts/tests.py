from django.test import TestCase
from django.contrib.auth import get_user_model
from types import SimpleNamespace
from graphene.test import Client

from vault.schema import schema
from .models import Friendship, Group, GroupMember

User = get_user_model()

class AccountsMutationTests(TestCase):
    def setUp(self):
        self.client = Client(schema)
        self.u1 = User.objects.create_user(username="alice", password="x")
        self.u2 = User.objects.create_user(username="bob", password="x")

    def test_unfriend(self):
        Friendship.objects.create(user=self.u1, friend=self.u2)
        Friendship.objects.create(user=self.u2, friend=self.u1)
        q = """
            mutation($id: ID!){
              unfriend(friendId:$id){ ok }
            }
        """
        self.client.execute(q, variables={"id": str(self.u2.id)}, context_value=SimpleNamespace(user=self.u1))
        self.assertFalse(Friendship.objects.exists())

    def test_leave_group(self):
        g = Group.objects.create(name="g1", owner=self.u1)
        GroupMember.objects.create(user=self.u1, group=g)
        GroupMember.objects.create(user=self.u2, group=g)
        q = """
            mutation($gid: ID!){
              leaveGroup(groupId:$gid){ ok }
            }
        """
        self.client.execute(q, variables={"gid": str(g.id)}, context_value=SimpleNamespace(user=self.u2))
        self.assertFalse(GroupMember.objects.filter(user=self.u2, group=g).exists())

    def test_remove_group_member(self):
        g = Group.objects.create(name="g1", owner=self.u1)
        GroupMember.objects.create(user=self.u1, group=g)
        GroupMember.objects.create(user=self.u2, group=g)
        q = """
            mutation($gid: ID!, $uid: ID!){
              removeGroupMember(groupId:$gid, userId:$uid){ ok }
            }
        """
        self.client.execute(
            q,
            variables={"gid": str(g.id), "uid": str(self.u2.id)},
            context_value=SimpleNamespace(user=self.u1),
        )
        self.assertFalse(GroupMember.objects.filter(user=self.u2, group=g).exists())
