import { IncomingMessage } from 'http';
import { verifyJwt } from './verify-jwt.js';
import { logger } from '../logger.js';

export const resolverUser = async (req: IncomingMessage) => {
  const token = req.headers['x-session-key'] || '';
  try {
    const decodedUser = await verifyJwt(token as string);
    return decodedUser;
  } catch (error) {
    logger.error('Failed to resolve user', error);
  }
};
