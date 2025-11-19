import {MutationResolvers} from '../../../generated/graphql.js';
import {CategorySettingsService} from '../../../service/category-setting-service.js';
import {logger} from '../../../logger.js';
import {adaptCategorySettings} from '../../../adapters/category-adapter.js';


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
      return adaptCategorySettings([updated])
    } catch (e) {
      logger.error(e.message)
    }
  }