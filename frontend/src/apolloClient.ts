// src/apolloClient.ts

import { ApolloClient, InMemoryCache, split } from "@apollo/client";
// Default‐import from the ESM file
import createUploadLink from "apollo-upload-client/createUploadLink.mjs";
import { setContext } from "@apollo/client/link/context";
import { GraphQLWsLink } from "@apollo/client/link/subscriptions";
import { getMainDefinition } from "@apollo/client/utilities";
import { createClient } from "graphql-ws";

// 1) Use createUploadLink so that file uploads (Upload scalars) are sent as multipart/form-data
const httpLink = createUploadLink({
  uri: import.meta.env.VITE_GRAPHQL_URL || "http://localhost:8000/graphql/",
});

// WebSocket link for subscriptions
const wsLink = new GraphQLWsLink(
  createClient({
    url:
      (import.meta.env.VITE_GRAPHQL_URL || "http://localhost:8000/graphql/")
        .replace(/^http/, "ws"),
    connectionParams: () => {
      const token = localStorage.getItem("token");
      return token ? { Authorization: `JWT ${token}` } : {};
    },
  })
);

// 2) Attach JWT on every request
const authLink = setContext((_, { headers }) => {
  const token = localStorage.getItem("token");
  return {
    headers: {
      ...headers,
      authorization: token ? `JWT ${token}` : "",
    },
  };
});

// 3) Split links so that subscriptions go over WebSocket
const splitLink = split(
  ({ query }) => {
    const def = getMainDefinition(query);
    return (
      def.kind === "OperationDefinition" && def.operation === "subscription"
    );
  },
  wsLink,
  httpLink
);

// 4) Combine authLink + splitLink into the Apollo Client
const client = new ApolloClient({
  link: authLink.concat(splitLink),
  cache: new InMemoryCache(),
});

export default client;
