import jwt, { JwtHeader } from 'jsonwebtoken';
import { jwksClientInstance } from './client.js';
import { User } from '../index.js';
import { logger } from '../logger.js';
import { GraphQLError } from 'graphql';

export async function verifyJwt(token: string): Promise<User> {
  try {
    const { decode, verify } = jwt;
    const kid = decode(token, { complete: true })?.header.kid;

    if (!kid) {
      logger.error('Invalid kid found');
      throw new Error('Invalid kid found');
    }

    const getSigningKey = (
      header: JwtHeader,
      callback: (err: Error, key: string) => void
    ) => {
      jwksClientInstance.getSigningKey(kid, (err, key) => {
        if (err) {
          callback(err, '');
          logger.error(`Error getting sign in key ${err.message}`);
          return;
        }
        const signingKey = key?.getPublicKey();
        callback(null, signingKey);
      });
    };

    const decodedToken = await new Promise<jwt.JwtPayload>(
      (resolve, reject) => {
        verify(token, getSigningKey, (err, decoded) => {
          if (err) {
            reject(err);
          } else {
            resolve(decoded as jwt.JwtPayload);
          }
        });
      }
    );
    return {
      userId: decodedToken.username,
      exp: decodedToken.exp,
      tokenUse: decodedToken.token_use,
      authTime: decodedToken.auth_time,
    };
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new GraphQLError(error.message, {
        extensions: {
          code: 'EXPIRED_JWT',
          http: { status: 403 },
          expiredAt: error.expiredAt,
        },
      });
    }
    throw error;
  }
}
