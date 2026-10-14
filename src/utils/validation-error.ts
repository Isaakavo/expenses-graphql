import { GraphQLError } from 'graphql';

export const validationError = (message: string, argumentName: string) =>
  new GraphQLError(message, {
    extensions: { code: 'VALIDATION_ERROR', argumentName },
  });
