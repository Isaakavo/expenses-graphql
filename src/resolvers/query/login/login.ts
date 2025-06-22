import { Auth_Status, QueryResolvers } from '../../../generated/graphql.js';
import { logger } from '../../../logger.js';

export const login: QueryResolvers['login'] = async (_, __, context) => {
  try {
    const {
      user: { userId, exp },
    } = context;

    if (!userId || !exp) {
      logger.error('userId or expiration time missing');
      return {
        status: Auth_Status.UNAUTHENTICATED,
      };
    }

    logger.info('JWT is valid, authenticated');
    return {
      status: Auth_Status.AUTHENTICATED,
    };
  } catch (error) {
    logger.error(`Error while trying to validate user ${error}`);
    return {
      status: Auth_Status.UNAUTHENTICATED,
    };
  }
};
