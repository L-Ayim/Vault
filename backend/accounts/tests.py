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
        )

        self.user.profile.refresh_from_db()
        self.assertEqual(
            self.user.profile.avatar_url,
            "http://example.com/avatar.png",
        )

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

    def test_update_profile_preferences(self):
        from .schema import UpdateProfile

        UpdateProfile().mutate(
            self._info(),
            preferences={"sidebar": True}
        )

        self.user.profile.refresh_from_db()
        self.assertEqual(self.user.profile.preferences, {"sidebar": True})


class DeleteGroupTests(TestCase):
    def setUp(self):
        User = get_user_model()
        self.owner = User.objects.create_user(username="owner", password="pw")
        self.other = User.objects.create_user(username="other", password="pw")
        self.grp = Group.objects.create(name="g", owner=self.owner)
        self._info_owner = self._info_for(self.owner)
        self._info_other = self._info_for(self.other)

    def _info_for(self, user):
        from types import SimpleNamespace

        return SimpleNamespace(context=SimpleNamespace(user=user))

    def test_owner_can_delete(self):
        from .schema import DeleteGroup

        DeleteGroup().mutate(self._info_owner, group_id=self.grp.id)
        self.assertFalse(Group.objects.filter(id=self.grp.id).exists())

    def test_non_owner_cannot_delete(self):
        from .schema import DeleteGroup
        from graphql import GraphQLError

        with self.assertRaises(GraphQLError):
            DeleteGroup().mutate(self._info_other, group_id=self.grp.id)
        self.assertTrue(Group.objects.filter(id=self.grp.id).exists())
