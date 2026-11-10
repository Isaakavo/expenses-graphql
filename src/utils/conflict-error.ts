import { GraphQLError } from 'graphql';

export const conflictError = (message: string) =>
  new GraphQLError(message, {
    extensions: { code: 'CONFLICT', http: { status: 409 } },
  });
