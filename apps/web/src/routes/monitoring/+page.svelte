<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { Alert, Icon, LoadingSpinner } from '@immich/ui';
  import {
    mdiDatabase,
    mdiConnection,
    mdiClockOutline,
    mdiAlertCircle,
    mdiCheckCircle,
    mdiDelete,
    mdiChevronDown,
    mdiChevronUp
  } from '@mdi/js';
  import type { DatabaseStats, ActiveQuery, FinishedQuery } from '$lib/types';
  import { streamDatabaseStats, fetchMonitoringStatus } from '$lib/api/client';

  let stats = $state<DatabaseStats | null>(null);
  let error = $state<string | null>(null);
  let available = $state<boolean | null>(null);
  let loading = $state(true);
  let cleanup: (() => void) | null = null;
  let finishedQueries = $state<FinishedQuery[]>([]);
  let previousQueries = $state<Map<number, ActiveQuery>>(new Map());
  let showFinishedQueries = $state(true);
  let showActiveQueries = $state(true);

  const STORAGE_KEY = 'monitoring_finished_queries';
  const MAX_FINISHED_QUERIES = 100;

  function loadFinishedQueries(): void {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        finishedQueries = JSON.parse(stored);
      }
    } catch (err) {
      console.warn('Failed to load finished queries from localStorage:', err);
      finishedQueries = [];
    }
  }

  function saveFinishedQueries(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(finishedQueries));
    } catch (err) {
      console.warn('Failed to save finished queries to localStorage:', err);
    }
  }

  function detectFinishedQueries(current: ActiveQuery[]): void {
    const currentPids = new Set(current.map(q => q.pid));
    const finished: FinishedQuery[] = [];

    // Find queries that were active but are now gone
    for (const [pid, query] of previousQueries) {
      if (!currentPids.has(pid) && query.duration !== null) {
        finished.push({
          pid,
          query: query.query,
          duration: query.duration,
          completedAt: Date.now(),
          username: query.username
        });
      }
    }

    // Add new finished queries to the list
    if (finished.length > 0) {
      finishedQueries = [...finished, ...finishedQueries].slice(0, MAX_FINISHED_QUERIES);
      saveFinishedQueries();
    }

    // Update the previous queries map
    previousQueries = new Map(current.map(q => [q.pid, q]));
  }

  function clearFinishedQueries(): void {
    finishedQueries = [];
    localStorage.removeItem(STORAGE_KEY);
  }

  function removeFinishedQuery(index: number): void {
    finishedQueries = finishedQueries.filter((_, i) => i !== index);
    saveFinishedQueries();
  }

  function formatDuration(ms: number | null): string {
    if (ms === null) return '-';
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
  }

  function formatQuery(query: string): string {
    // Truncate long queries and format nicely
    const cleaned = query.replace(/\s+/g, ' ').trim();
    if (cleaned.length > 200) {
      return cleaned.substring(0, 200) + '...';
    }
    return cleaned;
  }

  function getQueryColor(duration: number | null): string {
    if (duration === null) return 'text-gray-500';
    if (duration > 5000) return 'text-danger-500';
    if (duration > 1000) return 'text-warning-500';
    return 'text-success-500';
  }

  function getStateDisplay(query: ActiveQuery): { label: string; color: string } {
    if (query.waitEventType) {
      if (query.waitEventType === 'Lock') {
        return { label: `waiting on ${query.waitEvent || 'lock'}`, color: 'bg-orange-500/20 text-orange-700 dark:text-orange-300' };
      }
      return { label: `${query.waitEventType}`, color: 'bg-blue-500/20 text-blue-700 dark:text-blue-300' };
    }
    return {
      label: query.state,
      color: query.state === 'active' ? 'bg-green-500/20 text-green-700 dark:text-green-300' : 'bg-gray-200 text-gray-700 dark:bg-gray-600 dark:text-gray-200'
    };
  }

  function formatTime(ms: number): string {
    const date = new Date(ms);
    return date.toLocaleTimeString();
  }

  onMount(async () => {
    loadFinishedQueries();

    try {
      const status = await fetchMonitoringStatus();
      available = status.available;

      if (!status.available) {
        loading = false;
        return;
      }

      // Start streaming database stats
      cleanup = streamDatabaseStats((data) => {
        loading = false;
        if (data.type === 'error') {
          error = data.error || 'Unknown error';
          stats = null;
        } else if (data.type === 'stats' && data.stats) {
          error = null;
          stats = data.stats;
          detectFinishedQueries(data.stats.activeQueries);
        }
      });
    } catch (err) {
      loading = false;
      error = err instanceof Error ? err.message : 'Failed to connect';
    }
  });

  onDestroy(() => {
    cleanup?.();
  });
</script>

<div class="space-y-6">
  <!-- Header section -->
  <div>
    <p class="dark:text-white">
      Monitor active PostgreSQL database connections and queries in your Immich instance.
    </p>
  </div>

  {#if loading}
    <div class="flex flex-col items-center justify-center py-16 gap-4">
      <LoadingSpinner />
      <p class="text-sm text-gray-600 dark:text-gray-400">Connecting to database...</p>
    </div>
  {:else if available === false}
    <Alert color="warning">
      <div class="flex items-center gap-2">
        <Icon icon={mdiAlertCircle} size="1.25em" />
        <span>Database monitoring is not available. Make sure to configure the PostgreSQL connection in your environment variables (DB_HOST, DB_PORT, DB_DATABASE_NAME, DB_USERNAME, DB_PASSWORD).</span>
      </div>
    </Alert>
  {:else if error}
    <Alert color="danger">
      {error}
    </Alert>
  {:else if stats}
    <!-- Connection Stats -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div class="rounded-lg bg-gray-100 dark:bg-immich-dark-gray p-5">
        <div class="flex items-center gap-3">
          <div class="p-2 rounded-full bg-immich-primary/10 dark:bg-immich-dark-primary/20">
            <Icon icon={mdiConnection} size="1.5em" class="text-immich-primary dark:text-immich-dark-primary" />
          </div>
          <div>
            <p class="text-sm text-gray-500 dark:text-gray-400">Active Connections</p>
            <p class="text-2xl font-bold dark:text-white">{stats.activeConnections}</p>
          </div>
        </div>
      </div>

      <div class="rounded-lg bg-gray-100 dark:bg-immich-dark-gray p-5">
        <div class="flex items-center gap-3">
          <div class="p-2 rounded-full bg-green-500/10 dark:bg-green-500/20">
            <Icon icon={mdiDatabase} size="1.5em" class="text-green-600 dark:text-green-400" />
          </div>
          <div>
            <p class="text-sm text-gray-500 dark:text-gray-400">Idle Connections</p>
            <p class="text-2xl font-bold dark:text-white">{stats.idleConnections}</p>
          </div>
        </div>
      </div>

      <div class="rounded-lg bg-gray-100 dark:bg-immich-dark-gray p-5">
        <div class="flex items-center gap-3">
          <div class="p-2 rounded-full bg-blue-500/10 dark:bg-blue-500/20">
            <Icon icon={mdiClockOutline} size="1.5em" class="text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <p class="text-sm text-gray-500 dark:text-gray-400">Total Connections</p>
            <p class="text-2xl font-bold dark:text-white">{stats.totalConnections}</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Active Queries -->
    <div class="rounded-2xl overflow-hidden bg-gray-100 dark:bg-immich-dark-gray">
      <div class="flex items-center justify-between p-5 sm:p-7 hover:bg-gray-200 dark:hover:bg-gray-700/50 transition-colors cursor-pointer" onclick={() => (showActiveQueries = !showActiveQueries)}>
        <div class="flex-1">
          <h3 class="text-xl font-semibold text-immich-primary dark:text-immich-dark-primary uppercase">
            Active Queries ({stats.activeQueries.length})
          </h3>
          <p class="text-sm dark:text-white mt-1">
            Real-time view of currently executing database queries
          </p>
        </div>
        <Icon icon={showActiveQueries ? mdiChevronUp : mdiChevronDown} size="1.5em" class="text-gray-600 dark:text-gray-400 flex-shrink-0 ml-4" />
      </div>

      {#if showActiveQueries}
        {#if stats.activeQueries.length === 0}
          <div class="p-8 text-center">
            <Icon icon={mdiDatabase} size="3em" class="text-gray-400 dark:text-gray-500 mb-4" />
            <p class="dark:text-white">No active queries running</p>
            <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Queries will appear here when Immich is processing data
            </p>
          </div>
        {:else}
          <div class="overflow-x-auto">
            <table class="w-full">
              <thead class="bg-gray-200 dark:bg-gray-700">
                <tr>
                  <th class="px-4 py-3 text-left text-xs font-medium text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                    PID
                  </th>
                  <th class="px-4 py-3 text-left text-xs font-medium text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                    Duration
                  </th>
                  <th class="px-4 py-3 text-left text-xs font-medium text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                    State
                  </th>
                  <th class="px-4 py-3 text-left text-xs font-medium text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                    Query
                  </th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-200 dark:divide-gray-600">
                {#each stats.activeQueries as query (query.pid)}
                  {@const state = getStateDisplay(query)}
                  <tr class="hover:bg-gray-200/50 dark:hover:bg-gray-700/50">
                    <td class="px-4 py-3 whitespace-nowrap text-sm font-mono dark:text-white">
                      {query.pid}
                    </td>
                    <td class="px-4 py-3 whitespace-nowrap text-sm font-mono {getQueryColor(query.duration)}">
                      {formatDuration(query.duration)}
                    </td>
                    <td class="px-4 py-3 whitespace-nowrap">
                      <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium {state.color}">
                        {state.label}
                      </span>
                    </td>
                    <td class="px-4 py-3 text-sm dark:text-gray-200">
                      <code class="text-xs break-all">{formatQuery(query.query)}</code>
                    </td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        {/if}
      {/if}
    </div>

    <!-- Finished Queries -->
    {#if finishedQueries.length > 0}
      <div class="rounded-2xl overflow-hidden bg-gray-100 dark:bg-immich-dark-gray">
        <div class="flex items-center justify-between p-5 sm:p-7 hover:bg-gray-200 dark:hover:bg-gray-700/50 transition-colors cursor-pointer" onclick={() => (showFinishedQueries = !showFinishedQueries)}>
          <div class="flex-1">
            <h3 class="text-xl font-semibold text-immich-primary dark:text-immich-dark-primary uppercase">
              Finished Queries ({finishedQueries.length})
            </h3>
            <p class="text-sm dark:text-white mt-1">
              Recently completed database queries from this session
            </p>
          </div>
          <div class="flex items-center gap-3 ml-4">
            <button
              class="px-3 py-1 text-xs font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600 rounded transition-colors"
              onclick={(e) => {
                e.stopPropagation();
                clearFinishedQueries();
              }}
            >
              Clear History
            </button>
            <Icon icon={showFinishedQueries ? mdiChevronUp : mdiChevronDown} size="1.5em" class="text-gray-600 dark:text-gray-400 flex-shrink-0" />
          </div>
        </div>

        {#if showFinishedQueries}
          <div class="overflow-x-auto">
            <table class="w-full">
              <thead class="bg-gray-200 dark:bg-gray-700">
                <tr>
                  <th class="px-4 py-3 text-left text-xs font-medium text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                    PID
                  </th>
                  <th class="px-4 py-3 text-left text-xs font-medium text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                    Duration
                  </th>
                  <th class="px-4 py-3 text-left text-xs font-medium text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                    Completed At
                  </th>
                  <th class="px-4 py-3 text-left text-xs font-medium text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                    Query
                  </th>
                  <th class="px-4 py-3 text-left text-xs font-medium text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                  </th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-200 dark:divide-gray-600">
                {#each finishedQueries as finished, index (`${finished.pid}-${finished.completedAt}`)}
                  <tr class="hover:bg-gray-200/50 dark:hover:bg-gray-700/50">
                    <td class="px-4 py-3 whitespace-nowrap text-sm font-mono dark:text-white">
                      {finished.pid}
                    </td>
                    <td class="px-4 py-3 whitespace-nowrap text-sm font-mono text-success-500">
                      {formatDuration(finished.duration)}
                    </td>
                    <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                      {formatTime(finished.completedAt)}
                    </td>
                    <td class="px-4 py-3 text-sm dark:text-gray-200">
                      <code class="text-xs break-all">{formatQuery(finished.query)}</code>
                    </td>
                    <td class="px-4 py-3 whitespace-nowrap">
                      <button
                        class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
                        onclick={() => removeFinishedQuery(index)}
                        title="Remove from history"
                      >
                        <Icon icon={mdiDelete} size="1em" />
                      </button>
                    </td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        {/if}
      </div>
    {/if}

    <!-- Info panel -->
    <div class="rounded-lg bg-gray-100 dark:bg-immich-dark-gray p-4">
      <div class="flex gap-3">
        <Icon icon={mdiAlertCircle} size="1.25em" class="text-immich-primary dark:text-immich-dark-primary flex-shrink-0 mt-0.5" />
        <div class="text-sm dark:text-white">
          <p class="font-medium text-immich-primary dark:text-immich-dark-primary">About this view</p>
          <p class="mt-1 text-gray-700 dark:text-gray-300">
            This dashboard shows live PostgreSQL activity. When merging people, you may see expensive face-counting queries that can take several seconds.
            The merge is complete once these queries finish and no more active queries appear.
          </p>
          <p class="mt-2 text-gray-700 dark:text-gray-300">
            <strong>Enhanced state display:</strong> Orange badges indicate queries waiting on locks. Blue badges show other wait events.
            <strong>Finished queries:</strong> Recently completed queries are tracked in your browser's local storage and persist across sessions (up to 100 queries).
          </p>
        </div>
      </div>
    </div>
  {/if}
</div>
