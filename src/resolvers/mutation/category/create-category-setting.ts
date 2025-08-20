import { MutationResolvers } from 'generated/graphql';

export const createCategorySetting: MutationResolvers['createCategorySetting'] =
  () => {
    return {
      id: '1',
      message: 'Category setting created successfully',
    };
  };
