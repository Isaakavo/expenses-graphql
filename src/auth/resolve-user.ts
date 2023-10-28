import { IncomingMessage } from 'http';
import { verifyJwt } from './verify-jwt.js';

export const resolverUser = async (req: IncomingMessage) => {
  const token = req.headers['x-session-key'] || '';
  try {
    const decodedUser = await verifyJwt(token as string);
    return decodedUser;
  } catch (error) {
    console.error(error);
  }
};
