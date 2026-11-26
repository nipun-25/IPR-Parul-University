export interface ApiResponseSuccess<T> {
  success: true;
  data: T;
  meta: {
    requestId: string;
    timestamp: string;
  };
}
