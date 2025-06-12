// src/apolloClient.ts

import { ApolloClient, InMemoryCache, split } from "@apollo/client";
// Default import from the ESM file
import createUploadLink from "apollo-upload-client/createUploadLink.mjs";
import { GraphQLWsLink } from "@apollo/client/link/subscriptions";
import { getMainDefinition } from "@apollo/client/utilities";
import { createClient } from "graphql-ws";

// 1) Use createUploadLink so that file uploads (Upload scalars) are sent as multipart/form-data
const httpLink = createUploadLink({
  uri: import.meta.env.VITE_GRAPHQL_URL || "http://localhost:8000/graphql/",
  credentials: "include",
});

// Optional WebSocket link for subscriptions. If `VITE_GRAPHQL_WS_URL` is not
// provided, subscriptions will be disabled and only HTTP requests will be used.
const wsUrl = import.meta.env.VITE_GRAPHQL_WS_URL as string | undefined;
const wsLink = wsUrl
  ? new GraphQLWsLink(
      createClient({
        url: wsUrl,
      })
    )
  : null;

let link = httpLink;

if (wsLink) {
  // 3) Split links so that subscriptions go over WebSocket
  link = split(
    ({ query }) => {
      const def = getMainDefinition(query);
      return (
        def.kind === "OperationDefinition" && def.operation === "subscription"
      );
    },
    wsLink,
    httpLink
  );
}

// 2) Create the Apollo Client with the chosen link
const client = new ApolloClient({
  link,
  cache: new InMemoryCache(),
});

export default client;
