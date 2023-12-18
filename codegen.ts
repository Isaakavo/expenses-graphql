import type { CodegenConfig } from '@graphql-codegen/cli';

const config: CodegenConfig = {
  overwrite: true,
  schema: './schema.graphql',
  generates: {
    'src/generated/graphql.ts': {
      plugins: ['typescript', 'typescript-resolvers'],
      config: {
        namingConvention: {
          enumValues: 'change-case#upperCase'
        },
        useIndexSignature: true,
        scalars: {
          Date: '../scalars/date#Date'
        },
        contextType: '../index#Context'
      }
    },
    './graphql.schema.json': {
      plugins: ['introspection'],
    },
  },
};

export default config;
