import { PaginationQueryDto } from '../dto/pagination-query.dto';
import {
  PaginatedResult,
  PaginationMeta,
} from '../interfaces/paginated-result.interface';

export function getPrismaPagination(query: PaginationQueryDto) {
  return {
    skip: (query.page - 1) * query.limit,
    take: query.limit,
  };
}

export function buildPaginationMeta(
  query: PaginationQueryDto,
  total: number,
): PaginationMeta {
  const totalPages = Math.ceil(total / query.limit);

  return {
    page: query.page,
    limit: query.limit,
    total,
    totalPages,
    hasNextPage: query.page < totalPages,
    hasPreviousPage: query.page > 1,
  };
}

export function buildPaginatedResult<T>(
  data: T[],
  query: PaginationQueryDto,
  total: number,
): PaginatedResult<T> {
  return { data, meta: buildPaginationMeta(query, total) };
}
