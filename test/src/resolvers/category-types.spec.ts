import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { ApolloServer } from '@apollo/server';
import {
  Categories,
  SubCategory,
  resolveOrigin,
  resolveStatus,
} from '../../../src/resolvers/types/category-types.js';
import { adaptSubCategoryToGraphql } from '../../../src/adapters/category-adapter.js';
import { CategoryOrigin, CategoryStatus } from '../../../src/generated/graphql.js';

const typeDefs = readFileSync('./schema.graphql', { encoding: 'utf-8' });
const archivedAt = new Date('2026-09-30T00:00:00Z');

describe('SubCategory / Categories status and origin resolvers', () => {
  it.each([
    [{ userId: 'u1' }, CategoryOrigin.CUSTOM],
    [{ userId: null }, CategoryOrigin.DEFAULT],
    [{ user_id: 'u1' }, CategoryOrigin.CUSTOM],
    [{}, CategoryOrigin.DEFAULT],
    [{ userId: null, origin: CategoryOrigin.CUSTOM }, CategoryOrigin.CUSTOM],
  ])('resolveOrigin(%o) = %s', (parent, expected) => {
    expect(resolveOrigin(parent)).toBe(expected);
  });

  it.each([
    [{ archivedAt }, CategoryStatus.ARCHIVED],
    [{ archivedAt: null }, CategoryStatus.ACTIVE],
    [{ archived_at: '2026-09-30T00:00:00Z' }, CategoryStatus.ARCHIVED],
    [{}, CategoryStatus.ACTIVE],
    [{ archivedAt: null, status: CategoryStatus.ARCHIVED }, CategoryStatus.ARCHIVED],
  ])('resolveStatus(%o) = %s', (parent, expected) => {
    expect(resolveStatus(parent)).toBe(expected);
  });

  it('adapter output agrees with the field resolvers', () => {
    const row = { id: 's1', userId: 'u1', name: 'Concerts', archivedAt };
    expect(adaptSubCategoryToGraphql(row)).toMatchObject({
      status: CategoryStatus.ARCHIVED,
      origin: CategoryOrigin.CUSTOM,
    });
  });

  it('resolves both non-null fields for SubCategory nested in expenses and categories', async () => {
    // Parents deliberately lack status/origin, like raw Sequelize rows or older adapters.
    const server = new ApolloServer({
      typeDefs,
      resolvers: {
        SubCategory,
        Categories,
        Query: {
          expensesByCategory: () => [
            {
              category: { id: 'c1', name: 'LIFESTYLE' },
              subCategories: [
                {
                  subCategory: { id: 's1', userId: 'u1', name: 'Concerts', archivedAt },
                  expenses: [
                    {
                      id: 'e1',
                      concept: 'Show',
                      total: '$1.00',
                      payBefore: '01 Jan 2026',
                      createdAt: '01 January',
                      category: { id: 'c1', name: 'LIFESTYLE' },
                      subCategory: { id: 's2', userId: null, name: 'GYM' },
                    },
                  ],
                  total: '$1.00',
                },
              ],
              total: '$1.00',
            },
          ],
          categoryList: () => [
            { id: 'c2', userId: 'u1', name: 'Sports', archivedAt: null, subCategory: [] },
          ],
        },
      },
    });

    const response = await server.executeOperation({
      query: `{
        expensesByCategory(input: {}) {
          subCategories {
            subCategory { id status origin }
            expenses { subCategory { id status origin } }
          }
        }
        categoryList { id status origin }
      }`,
    });

    expect(response.body.kind).toBe('single');
    const result = response.body.kind === 'single' ? response.body.singleResult : undefined;
    expect(result?.errors).toBeUndefined();
    expect(result?.data).toEqual({
      expensesByCategory: [
        {
          subCategories: [
            {
              subCategory: { id: 's1', status: 'ARCHIVED', origin: 'CUSTOM' },
              expenses: [{ subCategory: { id: 's2', status: 'ACTIVE', origin: 'DEFAULT' } }],
            },
          ],
        },
      ],
      categoryList: [{ id: 'c2', status: 'ACTIVE', origin: 'CUSTOM' }],
    });
  });
});
