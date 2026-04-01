export const queryKeys = {
  terms: {
    all: () => ['terms'] as const,
    detail: (id: number) => ['terms', id] as const,
  },
}
