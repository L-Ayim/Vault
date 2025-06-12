// src/graphql/operations.ts

import { gql } from "@apollo/client";

/* ──────────────────────────────────────────────────────────────────────────────
   AUTHENTICATION (JWT) OPERATIONS
   ────────────────────────────────────────────────────────────────────────────── */

// 1) Obtain a JWT (returns token + payload)
export const MUTATION_TOKEN_AUTH = gql`
  mutation TokenAuth($username: String!, $password: String!) {
    tokenAuth(username: $username, password: $password) {
      token
      payload
    }
  }
`;

// 2) Verify a JWT
export const MUTATION_VERIFY_TOKEN = gql`
  mutation VerifyToken($token: String!) {
    verifyToken(token: $token) {
      payload
    }
  }
`;

// 3) Refresh a JWT
export const MUTATION_REFRESH_TOKEN = gql`
  mutation RefreshToken($refreshToken: String!) {
    refreshToken(refreshToken: $refreshToken) {
      token
      payload
    }
  }
`;

/* ──────────────────────────────────────────────────────────────────────────────
   ACCOUNTS (USERS / PROFILES / INVITES / FRIENDS / GROUPS)
   ────────────────────────────────────────────────────────────────────────────── */

// — Queries —

// 1) Current logged-in user
export const QUERY_ME = gql`
  query GetMe {
    me {
      id
      username
      email
      profile {
        avatarUrl
        bio
      }
    }
  }
`;

// 2) Incoming friend-invites (invites you can redeem)
export const QUERY_INCOMING_INVITES = gql`
  query GetIncomingInvites {
    incomingRequests {
      code
      createdBy {
        id
        username
      }
      codeType
      maxUses
      usesCount
      expiresAt
      isRevoked
      createdAt
    }
  }
`;

// 3) My friends (with pagination + optional username filter)
export const QUERY_FRIENDS = gql`
  query GetFriends(
    $limit: Int = 20
    $offset: Int = 0
    $usernameContains: String
  ) {
    friends(
      limit: $limit
      offset: $offset
      usernameContains: $usernameContains
    ) {
      id
      username
      email
      profile {
        avatarUrl
        bio
      }
    }
  }
`;

// 4) My groups (with pagination + optional name filter)
export const QUERY_MY_GROUPS = gql`
  query GetMyGroups($limit: Int = 20, $offset: Int = 0, $nameContains: String) {
    myGroups(limit: $limit, offset: $offset, nameContains: $nameContains) {
      id
      name
      owner {
        id
        username
      }
      inviteCode
      singleUse
      maxInviteUses
      inviteUsesCount
    }
  }
`;

// 5) Members of a given group
export const QUERY_GROUP_MEMBERS = gql`
  query GetGroupMembers($groupId: ID!) {
    groupMembers(groupId: $groupId) {
      id
      username
      email
      profile {
        avatarUrl
      }
    }
  }
`;

// — Mutations —

// 6) Register a new user (returns the user and a fresh JWT)
export const MUTATION_CREATE_USER = gql`
  mutation CreateUser($username: String!, $email: String!, $password: String!) {
    createUser(username: $username, email: $email, password: $password) {
      user {
        id
        username
        email
        profile {
          avatarUrl
          bio
        }
      }
      token
    }
  }
`;

// 7) Create a friend-invite (SINGLE or MULTI)
export const MUTATION_CREATE_FRIEND_INVITE = gql`
  mutation CreateFriendInvite(
    $codeType: String!
    $maxUses: Int
    $expiresAt: DateTime
  ) {
    createFriendInvite(
      codeType: $codeType
      maxUses: $maxUses
      expiresAt: $expiresAt
    ) {
      invite {
        code
        createdBy {
          id
          username
        }
        codeType
        maxUses
        usesCount
        expiresAt
        isRevoked
        createdAt
      }
    }
  }
`;

// 8) Redeem a friend-invite by code
export const MUTATION_REDEEM_FRIEND_INVITE = gql`
  mutation RedeemFriendInvite($code: String!) {
    redeemFriendInvite(code: $code) {
      friend {
        id
        username
        email
      }
    }
  }
`;

// 9) Revoke a friend-invite you created
export const MUTATION_REVOKE_FRIEND_INVITE = gql`
  mutation RevokeFriendInvite($code: String!) {
    revokeFriendInvite(code: $code) {
      ok
    }
  }
`;

// 10) Create a new group
export const MUTATION_CREATE_GROUP = gql`
  mutation CreateGroup(
    $name: String!
    $singleUse: Boolean!
    $maxInviteUses: Int = 100
  ) {
    createGroup(
      name: $name
      singleUse: $singleUse
      maxInviteUses: $maxInviteUses
    ) {
      group {
        id
        name
        owner {
          id
          username
        }
        inviteCode
        singleUse
        maxInviteUses
        inviteUsesCount
      }
    }
  }
`;

// 11) Join a group by invite code
export const MUTATION_JOIN_GROUP_BY_INVITE = gql`
  mutation JoinGroupByInvite($inviteCode: UUID!) {
    joinGroupByInvite(inviteCode: $inviteCode) {
      group {
        id
        name
        owner {
          id
          username
        }
        inviteCode
        singleUse
        maxInviteUses
        inviteUsesCount
      }
    }
  }
`;

// 12) Update the authenticated user's profile
export const MUTATION_UPDATE_PROFILE = gql`
  mutation UpdateProfile(
    $avatarUrl: String
    $avatarFileId: ID
    $bio: String
  ) {
    updateProfile(
      avatarUrl: $avatarUrl
      avatarFileId: $avatarFileId
      bio: $bio
    ) {
      profile {
        avatarUrl
        bio
      }
    }
  }
`;

// 13) Update the authenticated user's account info
export const MUTATION_UPDATE_USER = gql`
  mutation UpdateUser($username: String, $email: String, $password: String) {
    updateUser(username: $username, email: $email, password: $password) {
      user {
        id
        username
        email
      }
    }
  }
`;

// 14) Delete the current user's account
export const MUTATION_DELETE_ACCOUNT = gql`
  mutation DeleteAccount {
    deleteAccount {
      ok
    }
  }
`;

/* ──────────────────────────────────────────────────────────────────────────────
   FILES (UPLOADS / VERSIONS / SHARES)
   ────────────────────────────────────────────────────────────────────────────── */

// — Queries —

// 1) Files you own or have READ access to
export const QUERY_MY_FILES = gql`
  query GetMyFiles($limit: Int = 20, $offset: Int = 0, $nameContains: String) {
    myFiles(limit: $limit, offset: $offset, nameContains: $nameContains) {
      id
      name
      createdAt
      downloadUrl # ← returns the permanent MEDIA_URL path
      owner {
        id
        username
      }
      shares {
        id
        permission
        isPublic
        sharedWithUser {
          id
          username
        }
        sharedWithGroup {
          id
          name
        }
      }
    }
  }
`;

// 2) Publicly shared files
export const QUERY_PUBLIC_FILES = gql`
  query GetPublicFiles(
    $limit: Int = 20
    $offset: Int = 0
    $nameContains: String
  ) {
    publicFiles(limit: $limit, offset: $offset, nameContains: $nameContains) {
      id
      name
      createdAt
      downloadUrl
      owner {
        id
        username
      }
      shares {
        id
        permission
        isPublic
      }
    }
  }
`;

// 3) Versions of a single file
export const QUERY_FILE_VERSIONS = gql`
  query GetFileVersions($fileId: ID!, $limit: Int = 20, $offset: Int = 0) {
    fileVersions(fileId: $fileId, limit: $limit, offset: $offset) {
      id
      uploadUrl: upload
      note
      createdAt
    }
  }
`;

// — Mutations —

// 4) Upload a new file (requires multipart/form-data)
export const MUTATION_UPLOAD_FILE = gql`
  mutation UploadFile($name: String!, $upload: Upload!) {
    uploadFile(name: $name, upload: $upload) {
      file {
        id
        name
        downloadUrl # ← request permanent download URL
        createdAt
        owner {
          id
          username
        }
        shares {
          id
          permission
          isPublic
        }
      }
      version {
        id
        uploadUrl: upload
        note
        createdAt
      }
    }
  }
`;

// 5) Add a new version to an existing file
export const MUTATION_ADD_FILE_VERSION = gql`
  mutation AddFileVersion($fileId: ID!, $upload: Upload!, $note: String) {
    addFileVersion(fileId: $fileId, upload: $upload, note: $note) {
      version {
        id
        uploadUrl: upload
        note
        createdAt
      }
    }
  }
`;

// 6) Share a file with a specific user
export const MUTATION_SHARE_FILE_WITH_USER = gql`
  mutation ShareFileWithUser($fileId: ID!, $userId: ID!, $permission: String!) {
    shareFileWithUser(
      fileId: $fileId
      userId: $userId
      permission: $permission
    ) {
      share {
        id
        permission
        isPublic
        sharedWithUser {
          id
          username
        }
        sharedWithGroup {
          id
          name
        }
      }
    }
  }
`;

// 7) Share a file with a group
export const MUTATION_SHARE_FILE_WITH_GROUP = gql`
  mutation ShareFileWithGroup(
    $fileId: ID!
    $groupId: ID!
    $permission: String!
  ) {
    shareFileWithGroup(
      fileId: $fileId
      groupId: $groupId
      permission: $permission
    ) {
      share {
        id
        permission
        isPublic
        sharedWithGroup {
          id
          name
        }
      }
    }
  }
`;

// 8) Make a file publicly readable
export const MUTATION_MAKE_FILE_PUBLIC = gql`
  mutation MakeFilePublic($fileId: ID!, $permission: String = "R") {
    makeFilePublic(fileId: $fileId, permission: $permission) {
      share {
        id
        permission
        isPublic
      }
    }
  }
`;

// 9) Update the permission on an existing file share
export const MUTATION_UPDATE_FILE_SHARE = gql`
  mutation UpdateFileShare($shareId: ID!, $permission: String!) {
    updateFileShare(shareId: $shareId, permission: $permission) {
      share {
        id
        permission
        isPublic
      }
    }
  }
`;

// 10) Revoke (delete) a file share
export const MUTATION_REVOKE_FILE_SHARE = gql`
  mutation RevokeFileShare($shareId: ID!) {
    revokeFileShare(shareId: $shareId) {
      ok
    }
  }
`;

// 11) Keep (copy) a file (optionally copy all versions)
export const MUTATION_KEEP_FILE = gql`
  mutation KeepFile(
    $fileId: ID!
    $copyName: String
    $allVersions: Boolean = false
  ) {
    keepFile(fileId: $fileId, copyName: $copyName, allVersions: $allVersions) {
      file {
        id
        name
        downloadUrl # ← the copy’s download URL as well
        owner {
          id
          username
        }
      }
      versions {
        id
        uploadUrl: upload
        note
        createdAt
      }
    }
  }
`;

// 12) Rename a file
export const MUTATION_RENAME_FILE = gql`
  mutation RenameFile($fileId: ID!, $newName: String!) {
    renameFile(fileId: $fileId, newName: $newName) {
      file {
        id
        name
        downloadUrl # ← request updated download URL if name changed
      }
    }
  }
`;

// 13) Delete a file
export const MUTATION_DELETE_FILE = gql`
  mutation DeleteFile($fileId: ID!) {
    deleteFile(fileId: $fileId) {
      ok
    }
  }
`;

/* ──────────────────────────────────────────────────────────────────────────────
   CHAT (CHANNELS / MESSAGES)
   ────────────────────────────────────────────────────────────────────────────── */

// — Queries —

// 1) Channels that the current user belongs to
export const QUERY_MY_CHANNELS = gql`
  query GetMyChannels {
    myChannels {
      id
      name
      channelType
      node {
        id
        name
      }
      createdAt
    }
  }
`;

// 2) Messages for a specific channel (with pagination)
export const QUERY_CHANNEL_MESSAGES = gql`
  query GetChannelMessages(
    $channelId: ID!
    $limit: Int = 50
    $offset: Int = 0
  ) {
    channelMessages(channelId: $channelId, limit: $limit, offset: $offset) {
      id
      channel {
        id
        name
      }
      sender {
        id
        username
        profile {
          avatarUrl
        }
      }
      text
      attachment {
        id
        uploadUrl: upload
        note
        createdAt
      }
      createdAt
    }
  }
`;

// — Mutations —

// 3) Create (or retrieve) a direct (1:1) channel with another user
export const MUTATION_CREATE_DIRECT_CHANNEL = gql`
  mutation CreateDirectChannel($withUserId: ID!) {
    createDirectChannel(withUserId: $withUserId) {
      channel {
        id
        name
        channelType
        createdAt
      }
    }
  }
`;

// 4) Join the “node discussion” channel for a given node
export const MUTATION_JOIN_NODE_CHANNEL = gql`
  mutation JoinNodeChannel($nodeId: ID!) {
    joinNodeChannel(nodeId: $nodeId) {
      channel {
        id
        name
        channelType
        node {
          id
          name
        }
        createdAt
      }
    }
  }
`;

// 5) Join (or create) a group channel
export const MUTATION_JOIN_GROUP_CHANNEL = gql`
  mutation JoinGroupChannel($groupId: ID!) {
    joinGroupChannel(groupId: $groupId) {
      channel {
        id
        name
        channelType
        group {
          id
          name
        }
        createdAt
      }
    }
  }
`;

// 6) Send a message (with optional file upload) to a channel
export const MUTATION_SEND_MESSAGE = gql`
  mutation SendMessage($channelId: ID!, $text: String, $upload: Upload) {
    sendMessage(channelId: $channelId, text: $text, upload: $upload) {
      message {
        id
        channel {
          id
          name
        }
        sender {
          id
          username
        }
        text
        attachment {
          id
          uploadUrl: upload
          note
          createdAt
        }
        createdAt
      }
    }
  }
`;

/* ──────────────────────────────────────────────────────────────────────────────
   GRAPH (NODES / EDGES / SHARES)
   ────────────────────────────────────────────────────────────────────────────── */

// — Queries —

// 1) Ping (simple health check)
export const QUERY_PING = gql`
  query Ping {
    ping
  }
`;

// 2) Nodes the user owns or can read (with pagination + optional name filter)
export const QUERY_MY_NODES = gql`
  query GetMyNodes($limit: Int = 20, $offset: Int = 0, $nameContains: String) {
    myNodes(limit: $limit, offset: $offset, nameContains: $nameContains) {
      id
      name
      description
      createdAt
      owner {
        id
        username
      }
      files {
        note
        addedAt
        file {
          id
          name
          uploadUrl: upload
        }
      }
      edges {
        id
        nodeA {
          id
          name
        }
        nodeB {
          id
          name
        }
        label
        createdAt
      }
      shares {
        id
        permission
        isPublic
        sharedWithUser {
          id
          username
        }
        sharedWithGroup {
          id
          name
        }
      }
    }
  }
`;

// 3) Files attached to a specific node
export const QUERY_NODE_FILES = gql`
  query GetNodeFiles($nodeId: ID!, $limit: Int = 20, $offset: Int = 0) {
    nodeFiles(nodeId: $nodeId, limit: $limit, offset: $offset) {
      note
      addedAt
      file {
        id
        name
        uploadUrl: upload
      }
    }
  }
`;

// 4) Edges connected to a specific node
export const QUERY_NODE_EDGES = gql`
  query GetNodeEdges($nodeId: ID!, $limit: Int = 20, $offset: Int = 0) {
    nodeEdges(nodeId: $nodeId, limit: $limit, offset: $offset) {
      id
      nodeA {
        id
        name
      }
      nodeB {
        id
        name
      }
      label
      createdAt
    }
  }
`;

// 5) Publicly shared nodes
export const QUERY_PUBLIC_NODES = gql`
  query GetPublicNodes($limit: Int = 20, $offset: Int = 0) {
    publicNodes(limit: $limit, offset: $offset) {
      id
      name
      description
      createdAt
      owner {
        id
        username
      }
      shares {
        id
        permission
        isPublic
      }
    }
  }
`;

// — Mutations —

// 6) Create a new node
export const MUTATION_CREATE_NODE = gql`
  mutation CreateNode($name: String!, $description: String) {
    createNode(name: $name, description: $description) {
      node {
        id
        name
        description
        createdAt
        owner {
          id
          username
        }
      }
    }
  }
`;

// 7) Rename (or update) an existing node
export const MUTATION_RENAME_NODE = gql`
  mutation RenameNode($nodeId: ID!, $name: String, $description: String) {
    renameNode(nodeId: $nodeId, name: $name, description: $description) {
      node {
        id
        name
        description
        createdAt
      }
    }
  }
`;

// 8) Delete a node
export const MUTATION_DELETE_NODE = gql`
  mutation DeleteNode($nodeId: ID!) {
    deleteNode(nodeId: $nodeId) {
      ok
    }
  }
`;

// 9) Add a file to a node
export const MUTATION_ADD_FILE_TO_NODE = gql`
  mutation AddFileToNode($nodeId: ID!, $fileId: ID!, $note: String) {
    addFileToNode(nodeId: $nodeId, fileId: $fileId, note: $note) {
      nodeFile {
        note
        addedAt
        file {
          id
          name
          uploadUrl: upload
        }
      }
    }
  }
`;

// 10) Remove a file from a node
export const MUTATION_REMOVE_FILE_FROM_NODE = gql`
  mutation RemoveFileFromNode($nodeId: ID!, $fileId: ID!) {
    removeFileFromNode(nodeId: $nodeId, fileId: $fileId) {
      ok
    }
  }
`;

// 11) Move a file from one node to another
export const MUTATION_MOVE_FILE_BETWEEN_NODES = gql`
  mutation MoveFileBetweenNodes($fromNode: ID!, $toNode: ID!, $fileId: ID!) {
    moveFileBetweenNodes(
      fromNode: $fromNode
      toNode: $toNode
      fileId: $fileId
    ) {
      ok
    }
  }
`;

// 12) Create a new edge between two nodes
export const MUTATION_CREATE_EDGE = gql`
  mutation CreateEdge($nodeAId: ID!, $nodeBId: ID!, $label: String) {
    createEdge(nodeAId: $nodeAId, nodeBId: $nodeBId, label: $label) {
      edge {
        id
        nodeA {
          id
          name
        }
        nodeB {
          id
          name
        }
        label
        createdAt
      }
    }
  }
`;

// 13) Delete an edge
export const MUTATION_DELETE_EDGE = gql`
  mutation DeleteEdge($edgeId: ID!) {
    deleteEdge(edgeId: $edgeId) {
      ok
    }
  }
`;

// 14) Share a node with a user
export const MUTATION_SHARE_NODE_WITH_USER = gql`
  mutation ShareNodeWithUser($nodeId: ID!, $userId: ID!, $permission: String!) {
    shareNodeWithUser(
      nodeId: $nodeId
      userId: $userId
      permission: $permission
    ) {
      share {
        id
        permission
        isPublic
        sharedWithUser {
          id
          username
        }
      }
    }
  }
`;

// 15) Share a node with a group
export const MUTATION_SHARE_NODE_WITH_GROUP = gql`
  mutation ShareNodeWithGroup(
    $nodeId: ID!
    $groupId: ID!
    $permission: String!
  ) {
    shareNodeWithGroup(
      nodeId: $nodeId
      groupId: $groupId
      permission: $permission
    ) {
      share {
        id
        permission
        isPublic
        sharedWithGroup {
          id
          name
        }
      }
    }
  }
`;

// 16) Make a node publicly readable
export const MUTATION_MAKE_NODE_PUBLIC = gql`
  mutation MakeNodePublic($nodeId: ID!, $permission: String = "R") {
    makeNodePublic(nodeId: $nodeId, permission: $permission) {
      share {
        id
        permission
        isPublic
      }
    }
  }
`;

// 17) Update an existing node share
export const MUTATION_UPDATE_NODE_SHARE = gql`
  mutation UpdateNodeShare($shareId: ID!, $permission: String!) {
    updateNodeShare(shareId: $shareId, permission: $permission) {
      share {
        id
        permission
        isPublic
      }
    }
  }
`;

// 18) Revoke (delete) a node share
export const MUTATION_REVOKE_NODE_SHARE = gql`
  mutation RevokeNodeShare($shareId: ID!) {
    revokeNodeShare(shareId: $shareId) {
      ok
    }
  }
`;

/* ────────────────────────────────────────────────────────────────────────────
   SUBSCRIPTIONS
   ─────────────────────────────────────────────────────────────────────────── */

export const SUBSCRIPTION_NODE_UPDATES = gql`
  subscription NodeUpdates {
    nodeUpdates {
      id
    }
  }
`;

export const SUBSCRIPTION_MESSAGE_UPDATES = gql`
  subscription MessageUpdates($channelId: ID!) {
    messageUpdates(channelId: $channelId) {
      channelId
    }
  }
`;
