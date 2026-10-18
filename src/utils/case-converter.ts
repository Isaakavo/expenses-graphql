import pkg from 'lodash';
const { camelCase, isObject } = pkg;

export function toCamelCaseDeep<T = unknown>(input: unknown): T {

  if (input instanceof Date) {
    return input as T;
  }


  if (Array.isArray(input)) {
    return input.map((item) => toCamelCaseDeep(item)) as T;
  }

  if (isObject(input) && input !== null) {
    return Object.entries(input).reduce((acc, [key, value]) => {
      const camelKey = camelCase(key);
      acc[camelKey] = toCamelCaseDeep(value);
      return acc;
    }, {} as Record<string, unknown>) as T;
  }

  return input as T;
}
