export const textResponse = (data: unknown) => ({
  content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }],
});

export const errorResponse = (message: string) => ({
  content: [{ type: 'text' as const, text: `Error: ${message}` }],
  isError: true as const,
});
