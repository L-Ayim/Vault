// src/apolloClient.ts

import { ApolloClient, InMemoryCache } from "@apollo/client";
// Default‐import from the ESM file
import createUploadLink from "apollo-upload-client/createUploadLink.mjs";
import { setContext } from "@apollo/client/link/context";

// 1) Use createUploadLink so that file uploads (Upload scalars) are sent as multipart/form-data
const uploadLink = createUploadLink({
  uri: import.meta.env.VITE_GRAPHQL_URL || "http://localhost:8000/graphql/",
});

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

// 3) Combine authLink + uploadLink into the Apollo Client
const client = new ApolloClient({
  link: authLink.concat(uploadLink),
  cache: new InMemoryCache(),
});

export default client;
