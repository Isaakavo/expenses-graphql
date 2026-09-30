import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { ApolloServer } from '@apollo/server';
import {
  Categories,
  SubCategory,
  resolveIsArchived,
  resolveIsCustom,
} from '../../../src/resolvers/types/category-types.js';
import { adaptSubCategoryToGraphql } from '../../../src/adapters/category-adapter.js';

const typeDefs = readFileSync('./schema.graphql', { encoding: 'utf-8' });
const archivedAt = new Date('2026-09-30T00:00:00Z');

describe('SubCategory / Categories flag resolvers', () => {
  it.each([
    [{ userId: 'u1' }, true],
    [{ userId: null }, false],
    [{ user_id: 'u1' }, true],
    [{}, false],
    [{ userId: null, isCustom: true }, true],
  ])('resolveIsCustom(%o) = %s', (parent, expected) => {
    expect(resolveIsCustom(parent)).toBe(expected);
  });

  it.each([
    [{ archivedAt }, true],
    [{ archivedAt: null }, false],
    [{ archived_at: '2026-09-30T00:00:00Z' }, true],
    [{}, false],
    [{ archivedAt: null, isArchived: true }, true],
  ])('resolveIsArchived(%o) = %s', (parent, expected) => {
    expect(resolveIsArchived(parent)).toBe(expected);
  });

  it('adapter output agrees with the field resolvers', () => {
    const row = { id: 's1', userId: 'u1', name: 'Concerts', archivedAt };
    expect(adaptSubCategoryToGraphql(row)).toMatchObject({ isCustom: true, isArchived: true });
  });

  it('resolves both non-null fields for SubCategory nested in expenses and categories', async () => {
    // Parents deliberately lack isCustom/isArchived, like raw Sequelize rows or older adapters.
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
            subCategory { id isCustom isArchived }
            expenses { subCategory { id isCustom isArchived } }
          }
        }
        categoryList { id isCustom isArchived }
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
              subCategory: { id: 's1', isCustom: true, isArchived: true },
              expenses: [{ subCategory: { id: 's2', isCustom: false, isArchived: false } }],
            },
          ],
        },
      ],
      categoryList: [{ id: 'c2', isCustom: true, isArchived: false }],
    });
  });
});
