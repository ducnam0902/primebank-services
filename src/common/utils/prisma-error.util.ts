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

type DriverCause = {
  table?: string;
  constraint?: { fields?: string[]; index?: string };
};

export function getUniqueConstraintFields(e: PrismaKnownError): string[] {
  const cause = (
    e.meta?.driverAdapterError as { cause?: DriverCause } | undefined
  )?.cause;

  // Prisma 7.9: { fields: ['email'] }
  if (cause?.constraint?.fields?.length) return cause.constraint.fields;

  // Prisma 7.10+: { index: 'users_email_key' }, table: 'users'
  const index = cause?.constraint?.index;
  const table = cause?.table;
  if (
    index &&
    table &&
    index.startsWith(`${table}_`) &&
    index.endsWith('_key')
  ) {
    return [index.slice(table.length + 1, -'_key'.length)];
  }

  const target = e.meta?.target;
  if (Array.isArray(target)) return target as string[];
  if (typeof target === 'string') return [target];
  return [];
}
