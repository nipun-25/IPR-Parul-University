export interface OutboxTaskPayload {
  taskName: string;
  aggregateType: string;
  aggregateId: string;
  data: Record<string, unknown>;
}

export interface OutboxMessagePayload {
  eventType: string;
  aggregateType: string;
  aggregateId: string;
  data: Record<string, unknown>;
}
