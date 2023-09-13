import jwt from 'jsonwebtoken';
import { jwksClientInstance } from './client.js';
import { User } from '../index.js';

export async function verifyJwt(token: string): Promise<User> {
  const { decode, verify } = jwt;
  const kid = decode(token, { complete: true })?.header.kid;
  if (!kid) {
    throw new Error('Invalid token');
  }

  const getSigningKey = (header: any, callback: any) => {
    jwksClientInstance.getSigningKey(kid, (err, key) => {
      if (err) {
        callback(err);
        console.log({ err });
        return;
      }
      const signingKey = key?.getPublicKey();
      callback(null, signingKey);
    });
  };

  try {
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
      username: decodedToken.username,
      exp: decodedToken.exp,
      tokenUse: decodedToken.token_use,
      authTime: decodedToken.auth_time,
    };
  } catch (error) {
    console.log({ error });
  }
}
