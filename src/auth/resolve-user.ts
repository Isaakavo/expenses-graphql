import { IncomingMessage } from 'http';
import { verifyJwt } from './verify-jwt.js';
import { GraphQLError } from 'graphql';
import { User } from '../index.js';

export const resolverUser = async (req: IncomingMessage) => {
  const token = req.headers['x-session-key'] || '';
  const decodedUser = await verifyJwt(token as string);
  return validateUserToken(decodedUser);
};

export const validateUserToken = (decodedUser: User) => {
  if (!decodedUser) {
    throw new GraphQLError('User token is not valid', {
      extensions: {
        code: 'INVALID_JWT',
        http: { status: 403 },
      },
    });
  }

  return decodedUser;
};
