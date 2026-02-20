import { GraphQLError } from 'graphql';
import { Model, ModelStatic } from 'sequelize';
import { logger } from '../logger.js';

const NOT_FOUND_GRAPHQL_ERROR = (model: typeof Model) =>
  new GraphQLError(`${model.name} id not found`, {
    extensions: {
      code: 'NOT_FOUND',
      http: { status: 404 },
    },
  });

export const validateId = async (
  model: typeof Model,
  userId: string,
  id: string
) => {
  const modelToValidate = await (model as ModelStatic<Model>).findOne({
    where: { userId, id },
  });

  if (!modelToValidate) {
    logger.info(`Couldnt find card with id ${id}`);
    throw NOT_FOUND_GRAPHQL_ERROR(model);
  }

  return modelToValidate;
};

export const updateElement = async (
  model: typeof Model,
  userId: string,
  id: string,
  parameters: object
) => {
  try {
    const [affectedCount, updatedElement] = await (
      model as ModelStatic<Model>
    ).update(
      {
        ...parameters,
      },
      {
        where: {
          id,
          userId,
        },
        returning: true,
      }
    );

    if (updatedElement.length === 0) {
      logger.info(`Couldn't update ${model.name}, id doesnt exists`);
      throw NOT_FOUND_GRAPHQL_ERROR(model);
    }

    logger.info(`Updated ${model.name}, affectedCount ${affectedCount}`);

    return updatedElement;
  } catch (error) {
    logger.error(error);
    throw error;
  }
};

export const deleteElement = async (
  model: typeof Model,
  userId: string,
  id: string
) => {
  const isDeleted = await (model as ModelStatic<Model>).destroy({
    where: {
      id,
      userId,
    },
  });

  if (isDeleted === 0) {
    logger.info(`Couldnt delete ${model.name} with id ${id}`);
    throw new GraphQLError(`Couldnt delete ${model.name}`, {
      extensions: {
        code: 'CONFLICT',
        http: { status: 409 },
      },
    });
  }

  logger.info(`Deleted ${isDeleted} ${model.name}`);
  return true;
};
