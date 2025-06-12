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


class UpdateProfileTests(TestCase):
    def setUp(self):
        User = get_user_model()
        self.user = User.objects.create_user(username="user", password="pw")

    def _info(self):
        from types import SimpleNamespace

        return SimpleNamespace(context=SimpleNamespace(user=self.user))

    def test_update_profile_fields(self):
        from .schema import UpdateProfile

        UpdateProfile().mutate(
            self._info(),
            avatar_url="http://example.com/avatar.png",
            bio="Hello",
            is_public=True,
        )

        self.user.profile.refresh_from_db()
        self.assertEqual(self.user.profile.avatar_url, "http://example.com/avatar.png")
        self.assertEqual(self.user.profile.bio, "Hello")
        self.assertTrue(self.user.profile.is_public)
