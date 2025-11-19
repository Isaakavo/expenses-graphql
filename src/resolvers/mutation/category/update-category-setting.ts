import {MutationResolvers} from '../../../generated/graphql.js';
import {CategorySettingsService} from '../../../service/category-setting-service.js';
import {logger} from '../../../logger.js';


export const updateCategorySetting: MutationResolvers['updateCategorySetting'] =
  async (
    _,
    {input: {id, percentage}},
    {user: {userId}, sequelizeClient}
  ) => {
    try {
      const categorySettingsService = new CategorySettingsService(
        userId,
        sequelizeClient
      );

      const updated = await categorySettingsService.updateCategorySetting({id, percentage})


      // TODO add adapter for graphql response
      return {
        settings: [{
          id: updated.id,
          userId: updated.userId,
          name: 'generic xd',
          categoryId: updated.categoryId,
          percentage: updated.percentage * 100,
        }],
        percentageTotal: updated.percentage,
      };
    } catch (e) {
      logger.error(e.message)
    }
  }