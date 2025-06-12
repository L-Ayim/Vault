from django.test import TestCase
from django.contrib.auth import get_user_model

from .models import Group


class GroupInviteRotationTests(TestCase):
    def test_invite_rotates_after_limit(self):
        User = get_user_model()
        owner = User.objects.create_user(username="owner", password="pw")
        grp = Group.objects.create(name="g", owner=owner, max_invite_uses=2)

        first_code = grp.invite_code
        grp.register_invite_use()
        self.assertEqual(grp.invite_uses_count, 1)
        self.assertEqual(grp.invite_code, first_code)

        grp.register_invite_use()
        self.assertEqual(grp.invite_uses_count, 0)
        self.assertNotEqual(grp.invite_code, first_code)
