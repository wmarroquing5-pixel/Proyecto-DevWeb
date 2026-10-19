export interface ApiProblemDetails {
  status?: number;
  title?: string;
  detail?: string;
  errors?: Record<string, string[]>;
  traceId?: string;
}
