export type PaginatedQuery<TParams> = {
  // The parameters
  params?: TParams
  // The page at which to start the query
  page?: number
  // The number of items to return
  count?: number
}

export type PaginatedResult<T> = {
  data: T[]
  meta: {
    page: number
    count: number
    total: number
  }
}
