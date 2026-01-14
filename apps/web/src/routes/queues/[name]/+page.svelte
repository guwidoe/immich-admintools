<script lang="ts">
  import { invalidateAll } from '$app/navigation';
  import type { QueueStatus, JobInfo, JobState } from '$lib/types';
  import { pauseQueue, resumeQueue, fetchJobs } from '$lib/api/client';

  let { data } = $props<{ data: { queue: QueueStatus | null; queueName: string; error: string | null } }>();
  let actionLoading = $state(false);
  let actionError = $state<string | null>(null);

  // Job history state
  let activeTab = $state<JobState>('active');
  let jobs = $state<JobInfo[]>([]);
  let jobsTotal = $state(0);
  let jobsLoading = $state(false);
  let jobsError = $state<string | null>(null);
  let currentPage = $state(0);
  const pageSize = 20;

  async function loadJobs(state: JobState, page = 0) {
    jobsLoading = true;
    jobsError = null;
    try {
      const response = await fetchJobs(data.queueName, state, page, pageSize);
      jobs = response.jobs;
      jobsTotal = response.total;
      currentPage = page;
    } catch (err) {
      jobsError = err instanceof Error ? err.message : 'Failed to load jobs';
      jobs = [];
      jobsTotal = 0;
    } finally {
      jobsLoading = false;
    }
  }

  function switchTab(tab: JobState) {
    activeTab = tab;
    loadJobs(tab, 0);
  }

  function formatTimestamp(ts: number): string {
    if (!ts) return '-';
    return new Date(ts).toLocaleString();
  }

  function formatDuration(start?: number, end?: number): string {
    if (!start || !end) return '-';
    const ms = end - start;
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
  }

  // Load jobs on mount
  $effect(() => {
    if (data.queue) {
      loadJobs(activeTab);
    }
  });

  async function handlePauseResume() {
    if (!data.queue) return;
    actionLoading = true;
    actionError = null;
    try {
      if (data.queue.isPaused) {
        await resumeQueue(data.queueName);
      } else {
        await pauseQueue(data.queueName);
      }
      await invalidateAll();
    } catch (err) {
      actionError = err instanceof Error ? err.message : 'Action failed';
    } finally {
      actionLoading = false;
    }
  }
</script>

<div class="space-y-6">
  <div class="flex items-center gap-4">
    <a href="/" class="text-immich-dark-muted hover:text-white transition-colors" aria-label="Back to dashboard">
      <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
      </svg>
    </a>
    <div>
      <h1 class="text-2xl font-bold text-white">{data.queueName}</h1>
      <p class="text-immich-dark-muted mt-1">Queue details and management</p>
    </div>
  </div>

  {#if data.error}
    <div class="card bg-red-900/20 border-red-800">
      <div class="flex items-center gap-3">
        <svg class="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span class="text-red-400">{data.error}</span>
      </div>
    </div>
  {:else if data.queue}
    {#if actionError}
      <div class="card bg-red-900/20 border-red-800">
        <span class="text-red-400">{actionError}</span>
      </div>
    {/if}

    <!-- Queue Status Card -->
    <div class="card">
      <div class="flex items-center justify-between mb-4">
        <div class="flex items-center gap-3">
          <h2 class="text-lg font-semibold text-white">Status</h2>
          {#if data.queue.isPaused}
            <span class="px-2 py-1 text-xs bg-yellow-900/50 text-yellow-400 rounded">Paused</span>
          {:else}
            <span class="px-2 py-1 text-xs bg-green-900/50 text-green-400 rounded">Active</span>
          {/if}
        </div>
        <button
          onclick={handlePauseResume}
          disabled={actionLoading}
          class="px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50 {data.queue.isPaused ? 'bg-green-600 hover:bg-green-700 text-white' : 'bg-yellow-600 hover:bg-yellow-700 text-white'}"
        >
          {#if actionLoading}
            <span class="flex items-center gap-2">
              <div class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              Processing...
            </span>
          {:else}
            {data.queue.isPaused ? 'Resume Queue' : 'Pause Queue'}
          {/if}
        </button>
      </div>

      <!-- Tracked Stats (persistent completion tracking) -->
      <div class="grid grid-cols-2 gap-4 mb-4">
        <div class="p-4 bg-green-900/20 border border-green-800 rounded-lg">
          <p class="text-green-400 text-sm font-medium">Jobs Completed</p>
          <p class="text-3xl font-bold text-green-400">{(data.queue.trackedStats?.completed ?? 0).toLocaleString()}</p>
          <p class="text-xs text-immich-dark-muted mt-1">Tracked since monitoring started</p>
        </div>
        <div class="p-4 bg-red-900/20 border border-red-800 rounded-lg">
          <p class="text-red-400 text-sm font-medium">Jobs Failed</p>
          <p class="text-3xl font-bold text-red-400">{(data.queue.trackedStats?.failed ?? 0).toLocaleString()}</p>
          <p class="text-xs text-immich-dark-muted mt-1">Tracked since monitoring started</p>
        </div>
      </div>

      <!-- Current Queue State -->
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div class="p-4 bg-immich-dark-bg rounded-lg">
          <p class="text-immich-dark-muted text-sm">Waiting</p>
          <p class="text-2xl font-bold text-white">{data.queue.jobCounts.waiting.toLocaleString()}</p>
        </div>
        <div class="p-4 bg-immich-dark-bg rounded-lg">
          <p class="text-immich-dark-muted text-sm">Active</p>
          <p class="text-2xl font-bold text-white">{data.queue.jobCounts.active.toLocaleString()}</p>
        </div>
        <div class="p-4 bg-immich-dark-bg rounded-lg">
          <p class="text-immich-dark-muted text-sm">In Queue (Failed)</p>
          <p class="text-2xl font-bold {data.queue.jobCounts.failed > 0 ? 'text-red-400' : 'text-white'}">{data.queue.jobCounts.failed.toLocaleString()}</p>
        </div>
        <div class="p-4 bg-immich-dark-bg rounded-lg">
          <p class="text-immich-dark-muted text-sm">Delayed</p>
          <p class="text-2xl font-bold text-white">{data.queue.jobCounts.delayed.toLocaleString()}</p>
        </div>
      </div>
    </div>

    <!-- Stuck Jobs Section -->
    {#if data.queue.stuckJobs && data.queue.stuckJobs.length > 0}
      <div class="card border-yellow-800 bg-yellow-900/10">
        <h2 class="text-lg font-semibold text-yellow-400 mb-4">
          Stuck Jobs ({data.queue.stuckJobs.length})
        </h2>
        <div class="space-y-2">
          {#each data.queue.stuckJobs as job}
            <div class="p-3 bg-immich-dark-bg rounded-lg flex items-center justify-between">
              <div>
                <p class="text-white font-mono text-sm">{job.jobId}</p>
                {#if job.assetPath}
                  <p class="text-immich-dark-muted text-xs mt-1">{job.assetPath}</p>
                {/if}
              </div>
              <div class="text-right">
                <p class="text-yellow-400 text-sm">{Math.round(job.ageSeconds / 60)} min</p>
              </div>
            </div>
          {/each}
        </div>
      </div>
    {/if}

    <!-- Job History Tabs -->
    <div class="card">
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-lg font-semibold text-white">Job History</h2>
        <button
          onclick={() => loadJobs(activeTab, currentPage)}
          disabled={jobsLoading}
          class="px-3 py-1 text-sm bg-immich-dark-bg rounded hover:bg-immich-dark-border disabled:opacity-50 flex items-center gap-2"
        >
          <svg class="w-4 h-4 {jobsLoading ? 'animate-spin' : ''}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Refresh
        </button>
      </div>

      <!-- Tab Navigation -->
      <div class="flex border-b border-immich-dark-border mb-4">
        <button
          onclick={() => switchTab('active')}
          class="px-4 py-2 text-sm font-medium transition-colors {activeTab === 'active' ? 'text-immich-primary border-b-2 border-immich-primary' : 'text-immich-dark-muted hover:text-white'}"
        >
          Active ({data.queue.jobCounts.active})
        </button>
        <button
          onclick={() => switchTab('waiting')}
          class="px-4 py-2 text-sm font-medium transition-colors {activeTab === 'waiting' ? 'text-immich-primary border-b-2 border-immich-primary' : 'text-immich-dark-muted hover:text-white'}"
        >
          Waiting ({data.queue.jobCounts.waiting})
        </button>
        <button
          onclick={() => switchTab('failed')}
          class="px-4 py-2 text-sm font-medium transition-colors {activeTab === 'failed' ? 'text-red-400 border-b-2 border-red-400' : 'text-immich-dark-muted hover:text-white'}"
        >
          Failed ({data.queue.jobCounts.failed})
        </button>
        <button
          onclick={() => switchTab('delayed')}
          class="px-4 py-2 text-sm font-medium transition-colors {activeTab === 'delayed' ? 'text-yellow-400 border-b-2 border-yellow-400' : 'text-immich-dark-muted hover:text-white'}"
        >
          Delayed ({data.queue.jobCounts.delayed})
        </button>
      </div>

      <!-- Job List -->
      {#if jobsLoading}
        <div class="flex items-center justify-center py-8">
          <div class="w-6 h-6 border-2 border-immich-primary border-t-transparent rounded-full animate-spin"></div>
          <span class="ml-2 text-immich-dark-muted">Loading jobs...</span>
        </div>
      {:else if jobsError}
        <div class="p-4 bg-red-900/20 border border-red-800 rounded-lg">
          <span class="text-red-400">{jobsError}</span>
        </div>
      {:else if jobs.length === 0}
        <div class="text-center py-8 text-immich-dark-muted">
          No {activeTab} jobs found
        </div>
      {:else}
        <div class="space-y-2">
          {#each jobs as job}
            <div class="p-3 bg-immich-dark-bg rounded-lg">
              <div class="flex items-start justify-between">
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-2">
                    <span class="font-mono text-sm text-white">{job.id}</span>
                    <span class="text-xs px-2 py-0.5 bg-immich-dark-border rounded text-immich-dark-muted">{job.name}</span>
                  </div>
                  {#if job.data && Object.keys(job.data).length > 0}
                    <div class="mt-1 text-xs text-immich-dark-muted font-mono truncate">
                      {#if job.data.id}
                        Asset: {job.data.id}
                      {:else if job.data.assetId}
                        Asset: {job.data.assetId}
                      {:else}
                        {JSON.stringify(job.data).slice(0, 100)}{JSON.stringify(job.data).length > 100 ? '...' : ''}
                      {/if}
                    </div>
                  {/if}
                  {#if job.failedReason}
                    <div class="mt-1 text-xs text-red-400 truncate" title={job.failedReason}>
                      Error: {job.failedReason}
                    </div>
                  {/if}
                </div>
                <div class="text-right text-xs text-immich-dark-muted ml-4 flex-shrink-0">
                  <div>{formatTimestamp(job.timestamp)}</div>
                  {#if job.processedOn && job.finishedOn}
                    <div>Duration: {formatDuration(job.processedOn, job.finishedOn)}</div>
                  {:else if job.processedOn}
                    <div class="text-yellow-400">Processing...</div>
                  {/if}
                  {#if job.attemptsMade > 1}
                    <div class="text-yellow-400">Attempts: {job.attemptsMade}</div>
                  {/if}
                </div>
              </div>
            </div>
          {/each}
        </div>

        <!-- Pagination -->
        {#if jobsTotal > pageSize}
          <div class="flex items-center justify-between mt-4 pt-4 border-t border-immich-dark-border">
            <span class="text-sm text-immich-dark-muted">
              Showing {currentPage * pageSize + 1}-{Math.min((currentPage + 1) * pageSize, jobsTotal)} of {jobsTotal}
            </span>
            <div class="flex gap-2">
              <button
                onclick={() => loadJobs(activeTab, currentPage - 1)}
                disabled={currentPage === 0}
                class="px-3 py-1 text-sm bg-immich-dark-bg rounded hover:bg-immich-dark-border disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <button
                onclick={() => loadJobs(activeTab, currentPage + 1)}
                disabled={(currentPage + 1) * pageSize >= jobsTotal}
                class="px-3 py-1 text-sm bg-immich-dark-bg rounded hover:bg-immich-dark-border disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        {/if}
      {/if}
    </div>
  {:else}
    <div class="card">
      <p class="text-immich-dark-muted">Queue not found.</p>
    </div>
  {/if}
</div>
