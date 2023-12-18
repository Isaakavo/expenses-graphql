import { Category } from '../generated/graphql.js';

export const categoryAdapter = (category: Category) => Category[category.toUpperCase()];
