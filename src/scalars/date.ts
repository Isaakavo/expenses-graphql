import { GraphQLScalarType, Kind } from 'graphql';
import { parseISO } from 'date-fns';

export const Date = new GraphQLScalarType({
  name: 'Date',
  description: 'Scalar type for Date',

  // Convierte el valor enviado desde el cliente en la forma de entrada del tipo escalar.
  parseValue(value: any) {
    // Aquí puedes hacer cualquier validación o transformación necesaria para manejar las fechas enviadas desde el cliente.
    // En este ejemplo, simplemente convertimos el valor a una fecha de JavaScript.
    return parseISO(value);
  },

  // Convierte el valor recibido como argumento de consulta en la forma de salida del tipo escalar.
  serialize(value: any) {
    // Aquí puedes hacer cualquier transformación necesaria para mostrar las fechas en la respuesta.
    // En este ejemplo, simplemente devolvemos la fecha en formato ISO.
    return value.toISOString();
  },

  // Convierte el valor recibido en una representación literal para su uso en una consulta GraphQL.
  parseLiteral(ast) {
    if (ast.kind === Kind.STRING) {
      // Aquí puedes hacer cualquier validación o transformación necesaria para manejar las fechas literales en la consulta.
      // En este ejemplo, simplemente convertimos la cadena a una fecha de JavaScript.
      return parseISO(ast.value);
    }
    return null;
  },
});