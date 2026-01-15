export interface ActiveQuery {
  pid: number;
  username: string;
  database: string;
  state: string;
  query: string;
  queryStart: Date | null;
  duration: number | null; // milliseconds
  waitEventType: string | null;
  waitEvent: string | null;
}

export interface DatabaseStats {
  activeConnections: number;
  idleConnections: number;
  totalConnections: number;
  activeQueries: ActiveQuery[];
}
