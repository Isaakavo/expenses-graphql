import { describe, it, expect, vi, afterEach } from 'vitest';
import { readFileSync } from 'fs';
import { ApolloServer } from '@apollo/server';
import { Sequelize } from 'sequelize';
import { categoryList } from '../../../src/resolvers/query/category/category-list.js';
import { Categories, SubCategory } from '../../../src/resolvers/types/category-types.js';
import { CategoryRepository } from '../../../src/repository/category-repository.js';
import type { Context } from '../../../src/index.js';

const typeDefs = readFileSync('./schema.graphql', { encoding: 'utf-8' });

const server = new ApolloServer({
  typeDefs,
  resolvers: { Query: { categoryList }, Categories, SubCategory },
});

const run = (query: string) =>
  server.executeOperation(
    { query },
    { contextValue: { user: { userId: 'u1' }, sequelizeClient: {} as Sequelize } as unknown as Context }
  );

const singleResult = (response: Awaited<ReturnType<typeof run>>) =>
  response.body.kind === 'single' ? response.body.singleResult : undefined;

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Query.categoryList(statuses)', () => {
  it.each([
    ['omitted', '{ categoryList { id } }', ['ACTIVE']],
    ['[ARCHIVED]', '{ categoryList(statuses: [ARCHIVED]) { id } }', ['ARCHIVED']],
    [
      '[ACTIVE, ARCHIVED]',
      '{ categoryList(statuses: [ACTIVE, ARCHIVED]) { id } }',
      ['ACTIVE', 'ARCHIVED'],
    ],
  ])('statuses %s reaches the repository as %o', async (_label, query, expected) => {
    const spy = vi.spyOn(CategoryRepository.prototype, 'getCategoryList').mockResolvedValue([]);
    const result = singleResult(await run(query));
    expect(result?.errors).toBeUndefined();
    expect(result?.data).toEqual({ categoryList: [] });
    expect(spy).toHaveBeenCalledWith({ statuses: expected });
  });

  it('rejects an empty list with BAD_USER_INPUT', async () => {
    const spy = vi.spyOn(CategoryRepository.prototype, 'getCategoryList').mockResolvedValue([]);
    const result = singleResult(await run('{ categoryList(statuses: []) { id } }'));
    expect(result?.data).toEqual({ categoryList: null });
    expect(result?.errors?.[0]?.extensions?.code).toBe('BAD_USER_INPUT');
    expect(spy).not.toHaveBeenCalled();
  });

  it('exposes status and origin per level', async () => {
    const archivedAt = new Date('2026-09-30T00:00:00Z');
    vi.spyOn(CategoryRepository.prototype, 'getCategoryList').mockResolvedValue([
      {
        id: 'c1',
        userId: 'u1',
        name: 'Sports',
        archivedAt: null,
        subCategory: [{ id: 's1', userId: null, name: 'Estadio', archivedAt }],
      },
    ] as never);
    const result = singleResult(
      await run(
        '{ categoryList(statuses: [ACTIVE, ARCHIVED]) { id status origin subCategory { id status origin } } }'
      )
    );
    expect(result?.errors).toBeUndefined();
    expect(result?.data).toEqual({
      categoryList: [
        {
          id: 'c1',
          status: 'ACTIVE',
          origin: 'CUSTOM',
          subCategory: [{ id: 's1', status: 'ARCHIVED', origin: 'DEFAULT' }],
        },
      ],
    });
  });
});
