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
    mdiChevronUp,
    mdiContentCopy,
    mdiChevronLeft,
    mdiChevronRight,
    mdiArrowUp,
    mdiArrowDown,
    mdiMagnify,
    mdiClose
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
  let expandedActiveQueries = $state<Set<number>>(new Set());
  let expandedFinishedQueries = $state<Set<string>>(new Set());

  // Pagination, sorting, filtering for finished queries
  type SortColumn = 'pid' | 'duration' | 'completedAt' | 'query';
  type SortDirection = 'asc' | 'desc';
  let finishedPageSize = $state(25);
  let finishedCurrentPage = $state(1);
  let finishedSortColumn = $state<SortColumn>('completedAt');
  let finishedSortDirection = $state<SortDirection>('desc');
  let finishedFilter = $state('');

  const STORAGE_KEY = 'monitoring_finished_queries';

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
      finishedQueries = [...finished, ...finishedQueries];
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

  function formatQuery(query: string, expanded: boolean = false): string {
    // Clean up whitespace
    const cleaned = query.replace(/\s+/g, ' ').trim();
    if (expanded) {
      return cleaned;
    }
    // Truncate long queries when not expanded
    if (cleaned.length > 200) {
      return cleaned.substring(0, 200) + '...';
    }
    return cleaned;
  }

  function toggleActiveQueryExpansion(pid: number): void {
    const newSet = new Set(expandedActiveQueries);
    if (newSet.has(pid)) {
      newSet.delete(pid);
    } else {
      newSet.add(pid);
    }
    expandedActiveQueries = newSet;
  }

  function toggleFinishedQueryExpansion(key: string): void {
    const newSet = new Set(expandedFinishedQueries);
    if (newSet.has(key)) {
      newSet.delete(key);
    } else {
      newSet.add(key);
    }
    expandedFinishedQueries = newSet;
  }

  function isQueryLong(query: string): boolean {
    return query.replace(/\s+/g, ' ').trim().length > 200;
  }

  async function copyToClipboard(query: string): Promise<void> {
    const cleaned = query.replace(/\s+/g, ' ').trim();
    await navigator.clipboard.writeText(cleaned);
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

  // Derived: filtered finished queries
  let filteredFinishedQueries = $derived.by(() => {
    if (!finishedFilter.trim()) return finishedQueries;
    const lowerFilter = finishedFilter.toLowerCase();
    return finishedQueries.filter(q =>
      q.query.toLowerCase().includes(lowerFilter) ||
      q.pid.toString().includes(lowerFilter)
    );
  });

  // Derived: sorted finished queries
  let sortedFinishedQueries = $derived.by(() => {
    const sorted = [...filteredFinishedQueries];
    sorted.sort((a, b) => {
      let comparison = 0;
      switch (finishedSortColumn) {
        case 'pid':
          comparison = a.pid - b.pid;
          break;
        case 'duration':
          comparison = a.duration - b.duration;
          break;
        case 'completedAt':
          comparison = a.completedAt - b.completedAt;
          break;
        case 'query':
          comparison = a.query.localeCompare(b.query);
          break;
      }
      return finishedSortDirection === 'asc' ? comparison : -comparison;
    });
    return sorted;
  });

  // Derived: paginated finished queries
  let paginatedFinishedQueries = $derived.by(() => {
    const start = (finishedCurrentPage - 1) * finishedPageSize;
    return sortedFinishedQueries.slice(start, start + finishedPageSize);
  });

  // Derived: total pages
  let finishedTotalPages = $derived(Math.max(1, Math.ceil(filteredFinishedQueries.length / finishedPageSize)));

  // Reset to page 1 when filter changes
  $effect(() => {
    // Access finishedFilter to track it
    finishedFilter;
    finishedCurrentPage = 1;
  });

  function toggleSort(column: SortColumn): void {
    if (finishedSortColumn === column) {
      finishedSortDirection = finishedSortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      finishedSortColumn = column;
      finishedSortDirection = 'desc';
    }
  }

  function goToPage(page: number): void {
    finishedCurrentPage = Math.max(1, Math.min(page, finishedTotalPages));
  }

  function removeFinishedQueryByKey(key: string): void {
    const [pid, completedAt] = key.split('-');
    finishedQueries = finishedQueries.filter(q =>
      !(q.pid.toString() === pid && q.completedAt.toString() === completedAt)
    );
    saveFinishedQueries();
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
                {#each stats.activeQueries.toSorted((a, b) => a.pid - b.pid) as query (query.pid)}
                  {@const state = getStateDisplay(query)}
                  {@const isExpanded = expandedActiveQueries.has(query.pid)}
                  {@const isLong = isQueryLong(query.query)}
                  <tr class="hover:bg-gray-200/50 dark:hover:bg-gray-700/50">
                    <td class="px-4 py-3 whitespace-nowrap text-sm font-mono dark:text-white align-top">
                      {query.pid}
                    </td>
                    <td class="px-4 py-3 whitespace-nowrap text-sm font-mono {getQueryColor(query.duration)} align-top">
                      {formatDuration(query.duration)}
                    </td>
                    <td class="px-4 py-3 whitespace-nowrap align-top">
                      <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium {state.color}">
                        {state.label}
                      </span>
                    </td>
                    <td class="px-4 py-3 text-sm dark:text-gray-200">
                      <div class="flex items-start gap-2">
                        <code class="text-xs break-all whitespace-pre-wrap flex-1 select-text">{formatQuery(query.query, isExpanded)}</code>
                        <div class="flex items-center gap-1 flex-shrink-0">
                          {#if isLong}
                            <button
                              type="button"
                              class="text-xs text-immich-primary dark:text-immich-dark-primary hover:underline"
                              onclick={() => toggleActiveQueryExpansion(query.pid)}
                            >
                              {isExpanded ? '[collapse]' : '[expand]'}
                            </button>
                          {/if}
                          <button
                            type="button"
                            class="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
                            onclick={() => copyToClipboard(query.query)}
                            title="Copy query"
                          >
                            <Icon icon={mdiContentCopy} size="0.875em" />
                          </button>
                        </div>
                      </div>
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
              Recently completed database queries (stored in browser)
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
          <!-- Filter and controls -->
          <div class="px-4 pb-3 flex flex-wrap items-center gap-3">
            <!-- Search filter -->
            <div class="relative flex-1 min-w-48 max-w-md">
              <Icon icon={mdiMagnify} size="1em" class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Filter by query or PID..."
                bind:value={finishedFilter}
                class="w-full pl-9 pr-8 py-1.5 text-sm rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-immich-primary dark:focus:ring-immich-dark-primary"
              />
              {#if finishedFilter}
                <button
                  type="button"
                  class="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                  onclick={() => finishedFilter = ''}
                >
                  <Icon icon={mdiClose} size="0.875em" />
                </button>
              {/if}
            </div>

            <!-- Page size selector -->
            <div class="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
              <span>Show</span>
              <select
                bind:value={finishedPageSize}
                class="px-2 py-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-immich-primary"
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
              <span>per page</span>
            </div>

            <!-- Results count -->
            <span class="text-sm text-gray-500 dark:text-gray-400">
              {#if finishedFilter}
                {filteredFinishedQueries.length} of {finishedQueries.length} queries
              {:else}
                {finishedQueries.length} queries
              {/if}
            </span>
          </div>

          <div class="overflow-x-auto">
            <table class="w-full">
              <thead class="bg-gray-200 dark:bg-gray-700">
                <tr>
                  <th class="px-4 py-3 text-left text-xs font-medium text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                    <button
                      type="button"
                      class="flex items-center gap-1 hover:text-immich-primary dark:hover:text-immich-dark-primary"
                      onclick={() => toggleSort('pid')}
                    >
                      PID
                      {#if finishedSortColumn === 'pid'}
                        <Icon icon={finishedSortDirection === 'asc' ? mdiArrowUp : mdiArrowDown} size="0.875em" />
                      {/if}
                    </button>
                  </th>
                  <th class="px-4 py-3 text-left text-xs font-medium text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                    <button
                      type="button"
                      class="flex items-center gap-1 hover:text-immich-primary dark:hover:text-immich-dark-primary"
                      onclick={() => toggleSort('duration')}
                    >
                      Duration
                      {#if finishedSortColumn === 'duration'}
                        <Icon icon={finishedSortDirection === 'asc' ? mdiArrowUp : mdiArrowDown} size="0.875em" />
                      {/if}
                    </button>
                  </th>
                  <th class="px-4 py-3 text-left text-xs font-medium text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                    <button
                      type="button"
                      class="flex items-center gap-1 hover:text-immich-primary dark:hover:text-immich-dark-primary"
                      onclick={() => toggleSort('completedAt')}
                    >
                      Completed At
                      {#if finishedSortColumn === 'completedAt'}
                        <Icon icon={finishedSortDirection === 'asc' ? mdiArrowUp : mdiArrowDown} size="0.875em" />
                      {/if}
                    </button>
                  </th>
                  <th class="px-4 py-3 text-left text-xs font-medium text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                    <button
                      type="button"
                      class="flex items-center gap-1 hover:text-immich-primary dark:hover:text-immich-dark-primary"
                      onclick={() => toggleSort('query')}
                    >
                      Query
                      {#if finishedSortColumn === 'query'}
                        <Icon icon={finishedSortDirection === 'asc' ? mdiArrowUp : mdiArrowDown} size="0.875em" />
                      {/if}
                    </button>
                  </th>
                  <th class="px-4 py-3 text-left text-xs font-medium text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                  </th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-200 dark:divide-gray-600">
                {#each paginatedFinishedQueries as finished (`${finished.pid}-${finished.completedAt}`)}
                  {@const key = `${finished.pid}-${finished.completedAt}`}
                  {@const isExpanded = expandedFinishedQueries.has(key)}
                  {@const isLong = isQueryLong(finished.query)}
                  <tr class="hover:bg-gray-200/50 dark:hover:bg-gray-700/50">
                    <td class="px-4 py-3 whitespace-nowrap text-sm font-mono dark:text-white align-top">
                      {finished.pid}
                    </td>
                    <td class="px-4 py-3 whitespace-nowrap text-sm font-mono text-success-500 align-top">
                      {formatDuration(finished.duration)}
                    </td>
                    <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400 align-top">
                      {formatTime(finished.completedAt)}
                    </td>
                    <td class="px-4 py-3 text-sm dark:text-gray-200">
                      <div class="flex items-start gap-2">
                        <code class="text-xs break-all whitespace-pre-wrap flex-1 select-text">{formatQuery(finished.query, isExpanded)}</code>
                        <div class="flex items-center gap-1 flex-shrink-0">
                          {#if isLong}
                            <button
                              type="button"
                              class="text-xs text-immich-primary dark:text-immich-dark-primary hover:underline"
                              onclick={() => toggleFinishedQueryExpansion(key)}
                            >
                              {isExpanded ? '[collapse]' : '[expand]'}
                            </button>
                          {/if}
                          <button
                            type="button"
                            class="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
                            onclick={() => copyToClipboard(finished.query)}
                            title="Copy query"
                          >
                            <Icon icon={mdiContentCopy} size="0.875em" />
                          </button>
                        </div>
                      </div>
                    </td>
                    <td class="px-4 py-3 whitespace-nowrap align-top">
                      <button
                        class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
                        onclick={() => removeFinishedQueryByKey(key)}
                        title="Remove from history"
                      >
                        <Icon icon={mdiDelete} size="1em" />
                      </button>
                    </td>
                  </tr>
                {:else}
                  <tr>
                    <td colspan="5" class="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                      No queries match your filter
                    </td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>

          <!-- Pagination controls -->
          {#if finishedTotalPages > 1}
            <div class="px-4 py-3 flex items-center justify-between border-t border-gray-200 dark:border-gray-600">
              <div class="text-sm text-gray-600 dark:text-gray-400">
                Page {finishedCurrentPage} of {finishedTotalPages}
              </div>
              <div class="flex items-center gap-1">
                <button
                  type="button"
                  class="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                  onclick={() => goToPage(1)}
                  disabled={finishedCurrentPage === 1}
                  title="First page"
                >
                  <Icon icon={mdiChevronLeft} size="1em" />
                  <Icon icon={mdiChevronLeft} size="1em" class="-ml-2" />
                </button>
                <button
                  type="button"
                  class="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                  onclick={() => goToPage(finishedCurrentPage - 1)}
                  disabled={finishedCurrentPage === 1}
                  title="Previous page"
                >
                  <Icon icon={mdiChevronLeft} size="1em" />
                </button>

                <!-- Page numbers -->
                {#each Array.from({ length: Math.min(5, finishedTotalPages) }, (_, i) => {
                  const start = Math.max(1, Math.min(finishedCurrentPage - 2, finishedTotalPages - 4));
                  return start + i;
                }).filter(p => p <= finishedTotalPages) as page}
                  <button
                    type="button"
                    class="px-2.5 py-1 text-sm rounded {page === finishedCurrentPage
                      ? 'bg-immich-primary text-white dark:bg-immich-dark-primary'
                      : 'hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300'}"
                    onclick={() => goToPage(page)}
                  >
                    {page}
                  </button>
                {/each}

                <button
                  type="button"
                  class="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                  onclick={() => goToPage(finishedCurrentPage + 1)}
                  disabled={finishedCurrentPage === finishedTotalPages}
                  title="Next page"
                >
                  <Icon icon={mdiChevronRight} size="1em" />
                </button>
                <button
                  type="button"
                  class="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                  onclick={() => goToPage(finishedTotalPages)}
                  disabled={finishedCurrentPage === finishedTotalPages}
                  title="Last page"
                >
                  <Icon icon={mdiChevronRight} size="1em" />
                  <Icon icon={mdiChevronRight} size="1em" class="-ml-2" />
                </button>
              </div>
            </div>
          {/if}
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
            <strong>Finished queries:</strong> Recently completed queries are tracked in your browser's local storage and persist across sessions. You can filter, sort, and paginate the history.
          </p>
        </div>
      </div>
    </div>
  {/if}
</div>
