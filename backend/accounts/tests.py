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

        def build_absolute_uri(path=""):
            return f"http://testserver{path}"

        return SimpleNamespace(
            context=SimpleNamespace(user=self.user, build_absolute_uri=build_absolute_uri)
        )

    def test_update_profile_fields(self):
        from .schema import UpdateProfile

        UpdateProfile().mutate(
            self._info(),
            avatar_url="http://example.com/avatar.png",
            bio="Hello",
        )

        self.user.profile.refresh_from_db()
        self.assertEqual(self.user.profile.avatar_url, "http://example.com/avatar.png")
        self.assertEqual(self.user.profile.bio, "Hello")

    def test_update_profile_with_avatar_file(self):
        from .schema import UpdateProfile
        from files.models import File
        from django.core.files.base import ContentFile

        file = File.objects.create(
            owner=self.user,
            name="a.png",
            upload=ContentFile(b"avatar", "a.png"),
        )

        UpdateProfile().mutate(
            self._info(),
            avatar_file_id=file.id,
        )

        self.user.profile.refresh_from_db()
        self.assertEqual(self.user.profile.avatar_file_id, file.id)
