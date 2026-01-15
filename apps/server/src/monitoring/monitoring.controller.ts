import { Controller, Get, Sse } from '@nestjs/common';
import { Observable, interval, map, startWith, switchMap, from } from 'rxjs';
import { DatabaseService } from './database.service';
import type { DatabaseStats } from './monitoring.types';

interface MessageEvent {
  data: string;
}

@Controller('monitoring')
export class MonitoringController {
  constructor(private readonly databaseService: DatabaseService) {}

  @Get('status')
  getStatus(): { available: boolean } {
    return {
      available: this.databaseService.isAvailable(),
    };
  }

  @Get('database')
  async getDatabaseStats(): Promise<DatabaseStats | { error: string }> {
    if (!this.databaseService.isAvailable()) {
      return { error: 'Database monitoring not available' };
    }

    const stats = await this.databaseService.getDatabaseStats();
    if (!stats) {
      return { error: 'Failed to fetch database stats' };
    }

    return stats;
  }

  @Get('queries')
  async getActiveQueries() {
    if (!this.databaseService.isAvailable()) {
      return { error: 'Database monitoring not available', queries: [] };
    }

    const queries = await this.databaseService.getActiveQueries();
    return { queries };
  }

  @Sse('database/stream')
  streamDatabaseStats(): Observable<MessageEvent> {
    // Stream database stats every 2 seconds
    return interval(2000).pipe(
      startWith(0),
      switchMap(() => from(this.getDatabaseStatsForStream())),
      map((data) => ({
        data: JSON.stringify(data),
      })),
    );
  }

  private async getDatabaseStatsForStream(): Promise<{ type: string; stats?: DatabaseStats; error?: string }> {
    if (!this.databaseService.isAvailable()) {
      return { type: 'error', error: 'Database monitoring not available' };
    }

    const stats = await this.databaseService.getDatabaseStats();
    if (!stats) {
      return { type: 'error', error: 'Failed to fetch database stats' };
    }

    return { type: 'stats', stats };
  }
}
