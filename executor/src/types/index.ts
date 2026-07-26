export interface IndexedScheduleRow {
  schedule_id: string;
  next_execution: string;
  active: boolean;
  paused: boolean;
  cancelled: boolean;
}

export interface ExecutionTask {
  scheduleId: bigint;
  dueAt: number;
}
