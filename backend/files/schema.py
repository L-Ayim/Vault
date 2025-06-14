# files/schema.py

import os
import graphene
from graphql import GraphQLError
from graphene_django import DjangoObjectType
from graphene_file_upload.scalars import Upload
from django.db.models import Q

from files.models import File, Version, FileShare
from accounts.schema import UserType


# ── Types ────────────────────────────────────────────────────────────────────

class VersionType(DjangoObjectType):
    file_name = graphene.String()

    class Meta:
        model = Version
        fields = ("id", "upload", "note", "created_at")

    def resolve_file_name(self, info):
        return os.path.basename(self.upload.name)


class FileShareType(DjangoObjectType):
    class Meta:
        model = FileShare
        fields = "__all__"


class FileType(DjangoObjectType):
    owner        = graphene.Field(UserType, description="Owner of the file")
    download_url = graphene.String()
    shares       = graphene.List(FileShareType, description="Shares on this file")

    class Meta:
        model  = File
        fields = ("id", "name", "upload", "created_at", "owner", "shares")

    def resolve_owner(self, info):
        return self.owner

    def resolve_download_url(self, info):
        user = info.context.user
        group_ids = [] if user.is_anonymous else list(user.group_memberships.values_list("group", flat=True))

        # 1) Owner
        if not user.is_anonymous and self.owner_id == user.id:
            return info.context.build_absolute_uri(self.upload.url)

        # 2) Public READ
        if FileShare.objects.filter(file=self, is_public=True, permission=FileShare.READ).exists():
            return info.context.build_absolute_uri(self.upload.url)

        # 3) Shared with user READ
        if not user.is_anonymous and FileShare.objects.filter(
            file=self, shared_with_user=user, permission=FileShare.READ
        ).exists():
            return info.context.build_absolute_uri(self.upload.url)

        # 4) Shared with group READ
        if FileShare.objects.filter(
            file=self, shared_with_group__in=group_ids, permission=FileShare.READ
        ).exists():
            return info.context.build_absolute_uri(self.upload.url)

        raise GraphQLError("Permission denied.")

    def resolve_shares(self, info):
        user = info.context.user
        if user.is_anonymous or self.owner_id != user.id:
            raise GraphQLError("Permission denied.")
        return FileShare.objects.filter(file=self)


# ── Queries ─────────────────────────────────────────────────────────────────

class FilesQuery(graphene.ObjectType):
    my_files      = graphene.List(
        FileType,
        limit=graphene.Int(default_value=20),
        offset=graphene.Int(default_value=0),
        name_contains=graphene.String(),
        description="Files you own or have READ access to"
    )
    public_files  = graphene.List(
        FileType,
        limit=graphene.Int(default_value=20),
        offset=graphene.Int(default_value=0),
        name_contains=graphene.String(),
        description="Files shared publicly"
    )
    file_versions = graphene.List(
        VersionType,
        file_id=graphene.ID(required=True),
        limit=graphene.Int(default_value=20),
        offset=graphene.Int(default_value=0),
    )

    def resolve_my_files(self, info, limit, offset, name_contains=None):
        user = info.context.user
        if user.is_anonymous:
            raise GraphQLError("Authentication required.")
        group_ids = user.group_memberships.values_list("group", flat=True)
        qs = File.objects.filter(
            Q(owner=user)
            | Q(shares__is_public=True, shares__permission=FileShare.READ)
            | Q(shares__shared_with_user=user, shares__permission=FileShare.READ)
            | Q(shares__shared_with_group__in=group_ids, shares__permission=FileShare.READ)
        ).distinct()
        if name_contains:
            qs = qs.filter(name__icontains=name_contains)
        return qs[offset : offset + limit]

    def resolve_public_files(self, info, limit, offset, name_contains=None):
        qs = File.objects.filter(
            shares__is_public=True, shares__permission=FileShare.READ
        ).distinct()
        if name_contains:
            qs = qs.filter(name__icontains=name_contains)
        return qs[offset : offset + limit]

    def resolve_file_versions(self, info, file_id, limit, offset):
        user = info.context.user
        if user.is_anonymous:
            raise GraphQLError("Authentication required.")
        file = File.objects.filter(pk=file_id).first()
        if not file:
            raise GraphQLError("File not found.")
        FileType.resolve_download_url(file, info)
        qs = Version.objects.filter(file=file).order_by("-created_at")
        return qs[offset : offset + limit]


# ── Mutations ────────────────────────────────────────────────────────────────

class UploadFile(graphene.Mutation):
    file    = graphene.Field(FileType)
    version = graphene.Field(VersionType)

    class Arguments:
        name   = graphene.String(required=True)
        upload = Upload(required=True)

    def mutate(self, info, name, upload):
        user = info.context.user
        if user.is_anonymous:
            raise GraphQLError("Authentication required.")
        file = File.objects.create(owner=user, name=name, upload=upload)
        version = Version.objects.create(file=file, upload=upload, note="Initial upload")
        return UploadFile(file=file, version=version)


class AddFileVersion(graphene.Mutation):
    version = graphene.Field(VersionType)

    class Arguments:
        file_id = graphene.ID(required=True)
        upload  = Upload(required=True)
        note    = graphene.String()

    def mutate(self, info, file_id, upload, note=""):
        user = info.context.user
        file = File.objects.filter(pk=file_id, owner=user).first()
        if not file:
            raise GraphQLError("Only file owner can add versions.")
        version = Version.objects.create(file=file, upload=upload, note=note)
        return AddFileVersion(version=version)


class ShareFileWithUser(graphene.Mutation):
    share = graphene.Field(FileShareType)

    class Arguments:
        file_id    = graphene.ID(required=True)
        user_id    = graphene.ID(required=True)
        permission = graphene.String(required=True)

    def mutate(self, info, file_id, user_id, permission):
        user = info.context.user
        if user.is_anonymous:
            raise GraphQLError("Authentication required.")
        file = File.objects.filter(pk=file_id, owner=user).first()
        if not file:
            raise GraphQLError("You must own the file to share it.")
        target = type(user).objects.filter(pk=user_id).first()
        if not target:
            raise GraphQLError("User not found.")
        share, _ = FileShare.objects.update_or_create(
            file=file,
            shared_with_user=target,
            defaults={"permission": permission, "is_public": False}
        )
        return ShareFileWithUser(share=share)


class ShareFileWithGroup(graphene.Mutation):
    share = graphene.Field(FileShareType)

    class Arguments:
        file_id    = graphene.ID(required=True)
        group_id   = graphene.ID(required=True)
        permission = graphene.String(required=True)

    def mutate(self, info, file_id, group_id, permission):
        user = info.context.user
        if user.is_anonymous:
            raise GraphQLError("Authentication required.")
        file = File.objects.filter(pk=file_id, owner=user).first()
        if not file:
            raise GraphQLError("You must own the file to share it.")
        share, _ = FileShare.objects.update_or_create(
            file=file,
            shared_with_group_id=group_id,
            defaults={"permission": permission, "is_public": False}
        )
        return ShareFileWithGroup(share=share)


class MakeFilePublic(graphene.Mutation):
    share = graphene.Field(FileShareType)

    class Arguments:
        file_id    = graphene.ID(required=True)
        permission = graphene.String(default_value=FileShare.READ)

    def mutate(self, info, file_id, permission):
        user = info.context.user
        if user.is_anonymous:
            raise GraphQLError("Authentication required.")
        file = File.objects.filter(pk=file_id, owner=user).first()
        if not file:
            raise GraphQLError("You must own the file to share it.")
        share, _ = FileShare.objects.update_or_create(
            file=file,
            is_public=True,
            defaults={"permission": permission}
        )
        return MakeFilePublic(share=share)


class UpdateFileShare(graphene.Mutation):
    share = graphene.Field(FileShareType)

    class Arguments:
        share_id   = graphene.ID(required=True)
        permission = graphene.String(required=True)

    def mutate(self, info, share_id, permission):
        user = info.context.user
        if user.is_anonymous:
            raise GraphQLError("Authentication required.")
        share = FileShare.objects.filter(pk=share_id, file__owner=user).first()
        if not share:
            raise GraphQLError("Share not found or you are not the owner.")
        share.permission = permission
        share.save()
        return UpdateFileShare(share=share)


class RevokeFileShare(graphene.Mutation):
    ok = graphene.Boolean()

    class Arguments:
        share_id = graphene.ID(required=True)

    def mutate(self, info, share_id):
        user = info.context.user
        share = FileShare.objects.filter(pk=share_id, file__owner=user).first()
        if not share:
            raise GraphQLError("Share not found or you are not the owner.")
        share.delete()
        return RevokeFileShare(ok=True)


class KeepFile(graphene.Mutation):
    file     = graphene.Field(FileType)
    versions = graphene.List(VersionType)

    class Arguments:
        file_id      = graphene.ID(required=True)
        copy_name    = graphene.String()
        all_versions = graphene.Boolean(default_value=False)

    def mutate(self, info, file_id, copy_name=None, all_versions=False):
        user = info.context.user
        if user.is_anonymous:
            raise GraphQLError("Authentication required.")
        orig = File.objects.filter(pk=file_id).first()
        if not orig:
            raise GraphQLError("File not found.")
        FileType.resolve_download_url(orig, info)

        new_name = copy_name or f"{orig.name} (copy)"
        new_file = File.objects.create(owner=user, name=new_name, upload=orig.upload)

        versions_qs = orig.versions.order_by("created_at")
        if not all_versions:
            versions_qs = versions_qs.reverse()[:1]
        new_versions = []
        for v in versions_qs:
            nv = Version.objects.create(file=new_file, upload=v.upload, note=v.note)
            new_versions.append(nv)

        return KeepFile(file=new_file, versions=new_versions)


class RenameFile(graphene.Mutation):
    file = graphene.Field(FileType)

    class Arguments:
        file_id  = graphene.ID(required=True)
        new_name = graphene.String(required=True)

    def mutate(self, info, file_id, new_name):
        user = info.context.user
        if user.is_anonymous:
            raise GraphQLError("Authentication required.")
        file = File.objects.filter(pk=file_id, owner=user).first()
        if not file:
            raise GraphQLError("Only the owner can rename this file.")
        file.name = new_name
        file.save()
        return RenameFile(file=file)


class DeleteFile(graphene.Mutation):
    ok = graphene.Boolean()

    class Arguments:
        file_id = graphene.ID(required=True)

    def mutate(self, info, file_id):
        user = info.context.user
        if user.is_anonymous:
            raise GraphQLError("Authentication required.")
        file = File.objects.filter(pk=file_id, owner=user).first()
        if not file:
            raise GraphQLError("Only the owner can delete this file.")
        file.delete()
        return DeleteFile(ok=True)


class FilesMutation(graphene.ObjectType):
    upload_file            = UploadFile.Field()
    add_file_version       = AddFileVersion.Field()
    share_file_with_user   = ShareFileWithUser.Field()
    share_file_with_group  = ShareFileWithGroup.Field()
    make_file_public       = MakeFilePublic.Field()
    update_file_share      = UpdateFileShare.Field()
    revoke_file_share      = RevokeFileShare.Field()
    keep_file              = KeepFile.Field()
    rename_file            = RenameFile.Field()
    delete_file            = DeleteFile.Field()
