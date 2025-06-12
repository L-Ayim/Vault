// src/apolloClient.ts

import { ApolloClient, InMemoryCache, split } from "@apollo/client";
// Default import from the ESM file
import createUploadLink from "apollo-upload-client/createUploadLink.mjs";
import { setContext } from "@apollo/client/link/context";
import { GraphQLWsLink } from "@apollo/client/link/subscriptions";
import { getMainDefinition } from "@apollo/client/utilities";
import { createClient } from "graphql-ws";

// 1) Use createUploadLink so that file uploads (Upload scalars) are sent as multipart/form-data
const httpLink = createUploadLink({
  uri: import.meta.env.VITE_GRAPHQL_URL || "http://localhost:8000/graphql/",
});

// Optional WebSocket link for subscriptions. If `VITE_GRAPHQL_WS_URL` is not
// provided, subscriptions will be disabled and only HTTP requests will be used.
const wsUrl = import.meta.env.VITE_GRAPHQL_WS_URL as string | undefined;
const wsLink = wsUrl
  ? new GraphQLWsLink(
      createClient({
        url: wsUrl,
        connectionParams: () => {
          const token = localStorage.getItem("token");
          return token ? { Authorization: `JWT ${token}` } : {};
        },
      })
    )
  : null;

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

// 4) Combine authLink with the chosen link into the Apollo Client
const client = new ApolloClient({
  link: authLink.concat(link),
  cache: new InMemoryCache(),
});

export default client;
