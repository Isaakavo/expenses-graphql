import pkg from 'lodash';
const { camelCase, isArray, isObject } = pkg;

export function toCamelCaseDeep(input: any): any {

  if (input instanceof Date) {
    return input; // ✅ NO modificar los objetos Date
  }


  if (isArray(input)) {
    return input.map(toCamelCaseDeep);
  }

  if (isObject(input) && input !== null) {
    return Object.entries(input).reduce((acc, [key, value]) => {
      const camelKey = camelCase(key);
      acc[camelKey] = toCamelCaseDeep(value);
      return acc;
    }, {} as Record<string, any>);
  }

  return input;
}
