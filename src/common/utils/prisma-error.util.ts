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

/**
 * Returns the database column name(s) involved in a P2002 unique constraint
 * violation, e.g. ['email'] or ['phone_number'].
 *
 * With the `@prisma/adapter-pg` driver adapter (used by this project),
 * Prisma does not populate `error.meta.target`; instead the offending
 * column(s) are parsed from the Postgres error detail and placed under
 * `error.meta.driverAdapterError.cause.constraint.fields`. `target` is
 * read as a fallback for engines/adapters that do populate it.
 */
export function getUniqueConstraintFields(e: PrismaKnownError): string[] {
  const driverFields = (
    e.meta?.driverAdapterError as
      { cause?: { constraint?: { fields?: string[] } } } | undefined
  )?.cause?.constraint?.fields;
  if (driverFields?.length) return driverFields;

  const target = e.meta?.target;
  if (Array.isArray(target)) return target as string[];
  if (typeof target === 'string') return [target];

  return [];
}
