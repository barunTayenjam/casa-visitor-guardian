export interface ApiResponse<T = unknown> {
  success: true;
  data?: T;
}

export interface ApiError {
  success: false;
  error: string;
  details?: unknown;
}

export type ApiResult<T = unknown> = ApiResponse<T> | ApiError;

export interface PaginationParams {
  page?: string;
  pageSize?: string;
  sortBy?: string;
}

export interface PaginationMeta {
  totalEvents: number;
  currentPage: number;
  pageSize: number;
  totalPages: number;
  hasNext?: boolean;
  hasPrevious?: boolean;
}

export interface PaginatedResponse<T> {
  success: true;
  items: T[];
  pagination: PaginationMeta;
}
