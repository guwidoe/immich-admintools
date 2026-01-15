import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool, PoolClient } from 'pg';
import type { ActiveQuery, DatabaseStats } from './monitoring.types';

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private pool: Pool | null = null;
  private isConnected = false;

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit(): Promise<void> {
    const host = this.configService.get<string>('database.host', 'localhost');
    const port = this.configService.get<number>('database.port', 5432);
    const database = this.configService.get<string>('database.database', 'immich');
    const user = this.configService.get<string>('database.username', 'postgres');
    const password = this.configService.get<string>('database.password', 'postgres');

    console.log(`[DatabaseService] Connecting to PostgreSQL at ${host}:${port}/${database}`);

    try {
      this.pool = new Pool({
        host,
        port,
        database,
        user,
        password,
        max: 3, // Keep pool small - we only do monitoring queries
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 5000,
      });

      // Test the connection
      const client = await this.pool.connect();
      client.release();
      this.isConnected = true;
      console.log('[DatabaseService] Connected to PostgreSQL successfully');
    } catch (error) {
      console.warn('[DatabaseService] Failed to connect to PostgreSQL:', error);
      this.isConnected = false;
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      console.log('[DatabaseService] Disconnected from PostgreSQL');
    }
  }

  isAvailable(): boolean {
    return this.isConnected && this.pool !== null;
  }

  async getDatabaseStats(): Promise<DatabaseStats | null> {
    if (!this.pool || !this.isConnected) {
      return null;
    }

    let client: PoolClient | null = null;
    try {
      client = await this.pool.connect();

      // Query pg_stat_activity for active connections and queries
      const result = await client.query(`
        SELECT
          pid,
          usename as username,
          datname as database,
          state,
          query,
          query_start,
          EXTRACT(EPOCH FROM (now() - query_start)) * 1000 as duration_ms,
          wait_event_type,
          wait_event
        FROM pg_stat_activity
        WHERE datname = current_database()
          AND pid != pg_backend_pid()
        ORDER BY query_start ASC NULLS LAST
      `);

      const rows = result.rows;

      // Count connections by state
      let activeConnections = 0;
      let idleConnections = 0;
      const activeQueries: ActiveQuery[] = [];

      for (const row of rows) {
        if (row.state === 'active') {
          activeConnections++;
          activeQueries.push({
            pid: row.pid,
            username: row.username || 'unknown',
            database: row.database || 'unknown',
            state: row.state,
            query: row.query || '',
            queryStart: row.query_start ? new Date(row.query_start) : null,
            duration: row.duration_ms ? Math.round(row.duration_ms) : null,
            waitEventType: row.wait_event_type,
            waitEvent: row.wait_event,
          });
        } else if (row.state === 'idle' || row.state === 'idle in transaction') {
          idleConnections++;
        }
      }

      return {
        activeConnections,
        idleConnections,
        totalConnections: rows.length,
        activeQueries,
      };
    } catch (error) {
      console.error('[DatabaseService] Failed to get database stats:', error);
      return null;
    } finally {
      if (client) {
        client.release();
      }
    }
  }

  async getActiveQueries(): Promise<ActiveQuery[]> {
    const stats = await this.getDatabaseStats();
    return stats?.activeQueries || [];
  }
}
