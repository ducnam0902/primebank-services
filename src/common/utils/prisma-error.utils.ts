export interface PrismaKnownError {
  code: string;
  meta?: Record<string, unknown>;
  clientVersion: string;
}

export function isPrismaKnownError(e: unknown): e is PrismaKnownError {
  return (
    typeof e === 'object' &&
    e !== null &&
    'code' in e &&
    'clientVersion' in e &&
    typeof (e as any).code === 'string' &&
    (e as any).code.startsWith('P')
  );
}