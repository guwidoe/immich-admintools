<script lang="ts">
  import { invalidateAll } from '$app/navigation';
  import type { QueueStatus, JobInfo, JobState } from '$lib/types';
  import { pauseQueue, resumeQueue, fetchJobs } from '$lib/api/client';
  import { Alert, Badge, Button, Card, CardBody, Icon, LoadingSpinner } from '@immich/ui';
  import { mdiArrowLeft, mdiAlertCircle, mdiRefresh } from '@mdi/js';

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
    <a href="/" class="text-dark-400 hover:text-dark-50 transition-colors" aria-label="Back to dashboard">
      <Icon icon={mdiArrowLeft} size="20" />
    </a>
    <div>
      <h1 class="text-2xl font-bold text-dark-50">{data.queueName}</h1>
      <p class="text-dark-400 mt-1">Queue details and management</p>
    </div>
  </div>

  {#if data.error}
    <Alert color="danger">
      <div class="flex items-center gap-3">
        <Icon icon={mdiAlertCircle} size="20" />
        <span>{data.error}</span>
      </div>
    </Alert>
  {:else if data.queue}
    {#if actionError}
      <Alert color="danger">
        <span>{actionError}</span>
      </Alert>
    {/if}

    <!-- Queue Status Card -->
    <Card>
      <CardBody>
        <div class="flex items-center justify-between mb-4">
          <div class="flex items-center gap-3">
            <h2 class="text-lg font-semibold text-dark-50">Status</h2>
            {#if data.queue.isPaused}
              <Badge color="warning">Paused</Badge>
            {:else}
              <Badge color="success">Active</Badge>
            {/if}
          </div>
          <Button
            onclick={handlePauseResume}
            loading={actionLoading}
            color={data.queue.isPaused ? 'success' : 'warning'}
          >
            {data.queue.isPaused ? 'Resume Queue' : 'Pause Queue'}
          </Button>
        </div>

        <!-- Tracked Stats (persistent completion tracking) -->
        <div class="grid grid-cols-2 gap-4 mb-4">
          <div class="p-4 bg-success-900/20 border border-success-800 rounded-lg">
            <p class="text-success-500 text-sm font-medium">Jobs Completed</p>
            <p class="text-3xl font-bold text-success-500">{(data.queue.trackedStats?.completed ?? 0).toLocaleString()}</p>
            <p class="text-xs text-dark-400 mt-1">Tracked since monitoring started</p>
          </div>
          <div class="p-4 bg-danger-900/20 border border-danger-800 rounded-lg">
            <p class="text-danger-500 text-sm font-medium">Jobs Failed</p>
            <p class="text-3xl font-bold text-danger-500">{(data.queue.trackedStats?.failed ?? 0).toLocaleString()}</p>
            <p class="text-xs text-dark-400 mt-1">Tracked since monitoring started</p>
          </div>
        </div>

        <!-- Current Queue State -->
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div class="p-4 bg-dark-950 rounded-lg">
            <p class="text-dark-400 text-sm">Waiting</p>
            <p class="text-2xl font-bold text-dark-50">{data.queue.jobCounts.waiting.toLocaleString()}</p>
          </div>
          <div class="p-4 bg-dark-950 rounded-lg">
            <p class="text-dark-400 text-sm">Active</p>
            <p class="text-2xl font-bold text-dark-50">{data.queue.jobCounts.active.toLocaleString()}</p>
          </div>
          <div class="p-4 bg-dark-950 rounded-lg">
            <p class="text-dark-400 text-sm">In Queue (Failed)</p>
            <p class="text-2xl font-bold {data.queue.jobCounts.failed > 0 ? 'text-danger-500' : 'text-dark-50'}">{data.queue.jobCounts.failed.toLocaleString()}</p>
          </div>
          <div class="p-4 bg-dark-950 rounded-lg">
            <p class="text-dark-400 text-sm">Delayed</p>
            <p class="text-2xl font-bold text-dark-50">{data.queue.jobCounts.delayed.toLocaleString()}</p>
          </div>
        </div>
      </CardBody>
    </Card>

    <!-- Stuck Jobs Section -->
    {#if data.queue.stuckJobs && data.queue.stuckJobs.length > 0}
      <Card class="border-warning-800 bg-warning-900/10">
        <CardBody>
          <h2 class="text-lg font-semibold text-warning-500 mb-4">
            Stuck Jobs ({data.queue.stuckJobs.length})
          </h2>
          <div class="space-y-2">
            {#each data.queue.stuckJobs as job}
              <div class="p-3 bg-dark-950 rounded-lg flex items-center justify-between">
                <div>
                  <p class="text-dark-50 font-mono text-sm">{job.jobId}</p>
                  {#if job.assetPath}
                    <p class="text-dark-400 text-xs mt-1">{job.assetPath}</p>
                  {/if}
                </div>
                <div class="text-right">
                  <p class="text-warning-500 text-sm">{Math.round(job.ageSeconds / 60)} min</p>
                </div>
              </div>
            {/each}
          </div>
        </CardBody>
      </Card>
    {/if}

    <!-- Job History Tabs -->
    <Card>
      <CardBody>
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-lg font-semibold text-dark-50">Job History</h2>
          <Button
            size="small"
            variant="ghost"
            onclick={() => loadJobs(activeTab, currentPage)}
            loading={jobsLoading}
          >
            <Icon icon={mdiRefresh} size="16" />
            Refresh
          </Button>
        </div>

        <!-- Tab Navigation -->
        <div class="flex border-b border-dark-700 mb-4">
          <button
            onclick={() => switchTab('active')}
            class="px-4 py-2 text-sm font-medium transition-colors {activeTab === 'active' ? 'text-primary border-b-2 border-primary' : 'text-dark-400 hover:text-dark-50'}"
          >
            Active ({data.queue.jobCounts.active})
          </button>
          <button
            onclick={() => switchTab('waiting')}
            class="px-4 py-2 text-sm font-medium transition-colors {activeTab === 'waiting' ? 'text-primary border-b-2 border-primary' : 'text-dark-400 hover:text-dark-50'}"
          >
            Waiting ({data.queue.jobCounts.waiting})
          </button>
          <button
            onclick={() => switchTab('failed')}
            class="px-4 py-2 text-sm font-medium transition-colors {activeTab === 'failed' ? 'text-danger-500 border-b-2 border-danger-500' : 'text-dark-400 hover:text-dark-50'}"
          >
            Failed ({data.queue.jobCounts.failed})
          </button>
          <button
            onclick={() => switchTab('delayed')}
            class="px-4 py-2 text-sm font-medium transition-colors {activeTab === 'delayed' ? 'text-warning-500 border-b-2 border-warning-500' : 'text-dark-400 hover:text-dark-50'}"
          >
            Delayed ({data.queue.jobCounts.delayed})
          </button>
        </div>

        <!-- Job List -->
        {#if jobsLoading}
          <div class="flex items-center justify-center py-8">
            <LoadingSpinner />
            <span class="ml-2 text-dark-400">Loading jobs...</span>
          </div>
        {:else if jobsError}
          <Alert color="danger">
            <span>{jobsError}</span>
          </Alert>
        {:else if jobs.length === 0}
          <div class="text-center py-8 text-dark-400">
            No {activeTab} jobs found
          </div>
        {:else}
          <div class="space-y-2">
            {#each jobs as job}
              <div class="p-3 bg-dark-950 rounded-lg">
                <div class="flex items-start justify-between">
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-2">
                      <span class="font-mono text-sm text-dark-50">{job.id}</span>
                      <span class="text-xs px-2 py-0.5 bg-dark-800 rounded text-dark-400">{job.name}</span>
                    </div>
                    {#if job.data && Object.keys(job.data).length > 0}
                      <div class="mt-1 text-xs text-dark-400 font-mono truncate">
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
                      <div class="mt-1 text-xs text-danger-500 truncate" title={job.failedReason}>
                        Error: {job.failedReason}
                      </div>
                    {/if}
                  </div>
                  <div class="text-right text-xs text-dark-400 ml-4 flex-shrink-0">
                    <div>{formatTimestamp(job.timestamp)}</div>
                    {#if job.processedOn && job.finishedOn}
                      <div>Duration: {formatDuration(job.processedOn, job.finishedOn)}</div>
                    {:else if job.processedOn}
                      <div class="text-warning-500">Processing...</div>
                    {/if}
                    {#if job.attemptsMade > 1}
                      <div class="text-warning-500">Attempts: {job.attemptsMade}</div>
                    {/if}
                  </div>
                </div>
              </div>
            {/each}
          </div>

          <!-- Pagination -->
          {#if jobsTotal > pageSize}
            <div class="flex items-center justify-between mt-4 pt-4 border-t border-dark-700">
              <span class="text-sm text-dark-400">
                Showing {currentPage * pageSize + 1}-{Math.min((currentPage + 1) * pageSize, jobsTotal)} of {jobsTotal}
              </span>
              <div class="flex gap-2">
                <Button
                  size="small"
                  variant="ghost"
                  onclick={() => loadJobs(activeTab, currentPage - 1)}
                  disabled={currentPage === 0}
                >
                  Previous
                </Button>
                <Button
                  size="small"
                  variant="ghost"
                  onclick={() => loadJobs(activeTab, currentPage + 1)}
                  disabled={(currentPage + 1) * pageSize >= jobsTotal}
                >
                  Next
                </Button>
              </div>
            </div>
          {/if}
        {/if}
      </CardBody>
    </Card>
  {:else}
    <Card>
      <CardBody>
        <p class="text-dark-400">Queue not found.</p>
      </CardBody>
    </Card>
  {/if}
</div>
