import {MutationResolvers} from '../../../generated/graphql';
import {logger} from '../../../logger.js';
import {CategoryAllocationService} from '../../../service/category-allocation-service.js';
import {formatCurrency} from '../../../adapters/income-adapter.js';


export const updateCategoryAllocation: MutationResolvers['updateCategoryAllocation'] = async (
  _,
  {input: {id, incomeId, percentage}},
  {user: {userId}, sequelizeClient}
) => {
  try {
    const categoryAllocationServive = new CategoryAllocationService(userId, sequelizeClient);

    const updated = await categoryAllocationServive
      .updateCategoryAllocation(incomeId, id, percentage)

    return {
      id: '',
      message: ''
    }
  } catch (e) {
    logger.error(e.message)
    throw e
  }
}