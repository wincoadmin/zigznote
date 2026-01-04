/**
 * Base repository with common CRUD operations
 * Implements the repository pattern for data access abstraction
 */

import type { Prisma } from '@prisma/client';
import { prisma } from '../client';
import type { PaginationOptions, PaginatedResult } from '../types';
import {
  normalizePaginationOptions,
  calculateSkip,
  createPaginatedResult,
} from '../utils/pagination';

/**
 * Generic base repository that can be extended for specific entities
 * Provides common CRUD operations with soft delete support
 */
export abstract class BaseRepository<
  TModel,
  TCreateInput,
  TUpdateInput,
  TWhereInput,
  TOrderByInput,
  TInclude,
> {
  protected abstract readonly modelName: Prisma.ModelName;

  /**
   * Gets the Prisma delegate for this model
   */
  protected get delegate(): Prisma.TransactionClient {
    return prisma;
  }

  /**
   * Checks if the model supports soft delete (has deletedAt field)
   */
  protected abstract readonly supportsSoftDelete: boolean;

  /**
   * Adds soft delete filter to where clause if supported
   */
  protected withSoftDeleteFilter<T extends Record<string, unknown>>(
    where: T,
    includeDeleted = false
  ): T {
    if (!this.supportsSoftDelete || includeDeleted) {
      return where;
    }
    return { ...where, deletedAt: null };
  }

  /**
   * Finds a single record by ID
   * @param id - Record ID
   * @param include - Relations to include
   * @param includeDeleted - Whether to include soft-deleted records
   * @returns Record or null if not found
   */
  abstract findById(
    id: string,
    include?: TInclude,
    includeDeleted?: boolean
  ): Promise<TModel | null>;

  /**
   * Finds all records matching the filter
   * @param where - Filter conditions
   * @param orderBy - Sort order
   * @param include - Relations to include
   * @returns Array of matching records
   */
  abstract findMany(
    where?: TWhereInput,
    orderBy?: TOrderByInput,
    include?: TInclude
  ): Promise<TModel[]>;

  /**
   * Finds records with pagination
   * @param options - Pagination options
   * @param where - Filter conditions
   * @param orderBy - Sort order
   * @param include - Relations to include
   * @returns Paginated result with metadata
   */
  abstract findManyPaginated(
    options: PaginationOptions,
    where?: TWhereInput,
    orderBy?: TOrderByInput,
    include?: TInclude
  ): Promise<PaginatedResult<TModel>>;

  /**
   * Counts records matching the filter
   * @param where - Filter conditions
   * @returns Count of matching records
   */
  abstract count(where?: TWhereInput): Promise<number>;

  /**
   * Creates a new record
   * @param data - Record data
   * @param include - Relations to include in returned record
   * @returns Created record
   */
  abstract create(data: TCreateInput, include?: TInclude): Promise<TModel>;

  /**
   * Updates a record by ID
   * @param id - Record ID
   * @param data - Update data
   * @param include - Relations to include in returned record
   * @returns Updated record
   */
  abstract update(
    id: string,
    data: TUpdateInput,
    include?: TInclude
  ): Promise<TModel>;

  /**
   * Soft deletes a record by ID (sets deletedAt)
   * Falls back to hard delete if soft delete not supported
   * @param id - Record ID
   */
  abstract softDelete(id: string): Promise<void>;

  /**
   * Hard deletes a record by ID (permanent deletion)
   * @param id - Record ID
   */
  abstract hardDelete(id: string): Promise<void>;

  /**
   * Restores a soft-deleted record
   * @param id - Record ID
   * @returns Restored record
   */
  abstract restore(id: string): Promise<TModel>;
}

/**
 * Helper class for building paginated queries
 */
export class PaginatedQueryBuilder<_TModel> {
  private _where: Record<string, unknown> = {};
  private _orderBy: Record<string, 'asc' | 'desc'>[] = [];
  private _include: Record<string, unknown> = {};
  private _pagination: { skip: number; take: number } = { skip: 0, take: 20 };

  constructor(private readonly countFn: () => Promise<number>) {}

  where(conditions: Record<string, unknown>): this {
    this._where = { ...this._where, ...conditions };
    return this;
  }

  orderBy(field: string, direction: 'asc' | 'desc' = 'desc'): this {
    this._orderBy.push({ [field]: direction });
    return this;
  }

  include(relations: Record<string, unknown>): this {
    this._include = { ...this._include, ...relations };
    return this;
  }

  paginate(options: PaginationOptions): this {
    const normalized = normalizePaginationOptions(options);
    this._pagination = {
      skip: calculateSkip(normalized.page, normalized.limit),
      take: normalized.limit,
    };
    return this;
  }

  async execute<T>(queryFn: (args: {
    where: Record<string, unknown>;
    orderBy: Record<string, 'asc' | 'desc'>[];
    include: Record<string, unknown>;
    skip: number;
    take: number;
  }) => Promise<T[]>): Promise<PaginatedResult<T>> {
    const [data, total] = await Promise.all([
      queryFn({
        where: this._where,
        orderBy: this._orderBy,
        include: this._include,
        ...this._pagination,
      }),
      this.countFn(),
    ]);

    const page = Math.floor(this._pagination.skip / this._pagination.take) + 1;
    return createPaginatedResult(data, total, {
      page,
      limit: this._pagination.take,
    });
  }
}
