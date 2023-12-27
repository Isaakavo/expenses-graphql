import { GraphQLError } from 'graphql';
import { Model, ModelStatic } from 'sequelize';
import { Logger } from 'winston';

export const validateId = async (
  model: typeof Model,
  userId: string,
  id: string,
  logger: Logger
) => {
  const modelToValidate = await (model as ModelStatic<Model>).findOne({
    where: { userId, id },
  });

  if (!modelToValidate) {
    logger.info(`Couldnt find card with id ${id}`);
    throw new GraphQLError(`${model.name} id not found`, {
      extensions: {
        code: 'NOT_FOUND',
        http: { status: 404 },
      },
    });
  }

  return modelToValidate;
};

export const deleteElement = async (
  model: typeof Model,
  userId: string,
  id: string,
  logger: Logger
) => {
  const isDeleted = await (model as ModelStatic<Model>).destroy({
    where: {
      id,
      userId
    }
  })

  if (isDeleted === 0) {
    logger.info(`Couldnt delete ${model.name} with id ${id}`);
    throw new GraphQLError(`Couldnt delete ${model.name}`, {
      extensions: {
        code: 'CONFLICT',
        http: { status: 409 },
      },
    });
  }

  logger.info(`Deleted ${isDeleted} ${model.name}`)
  return true;
};
