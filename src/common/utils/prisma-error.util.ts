export interface PrismaKnownError {
  code: string;
  meta?: Record<string, unknown>;
  clientVersion: string;
}

export function isPrismaKnownError(e: unknown): e is PrismaKnownError {
  return (
    typeof e === 'object' &&
    e !== null &&
    'clientVersion' in e &&
    'code' in e &&
    typeof e.code === 'string' &&
    e.code.startsWith('P')
  );
}
