import { Resolver, ResolverFn } from '../generated/graphql.js';
import { logger } from '../logger.js';

function extractFn<TResult, TParent, TContext, TArgs>(
  resolver: Resolver<TResult, TParent, TContext, TArgs>
): ResolverFn<TResult, TParent, TContext, TArgs> {
  if (typeof resolver === 'function') {
    return resolver;
  }
  return resolver.resolve;
}

export const withErrorHandling = <TResult, TParent, TContext, TArgs>(
  resolverName: string,
  resolver: Resolver<TResult, TParent, TContext, TArgs>
): ResolverFn<TResult, TParent, TContext, TArgs> => {
  const fn = extractFn(resolver);
  return async (parent, args, context, info) => {
    try {
      return await fn(parent, args, context, info);
    } catch (error) {
      logger.error(`[${resolverName}] ${error.message}`, { stack: error.stack });
      throw error;
    }
  };
};
