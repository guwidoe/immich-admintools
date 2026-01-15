<script lang="ts">
  import type { QueueStatus } from '$lib/types';
  import type { AppSettings } from '$lib/api/client';
  import { updateSettings } from '$lib/api/client';
  import { Alert, Badge, Card, CardBody, Icon, Button } from '@immich/ui';
  import { mdiAlertCircle, mdiContentSave, mdiChevronDown } from '@mdi/js';

  let { data } = $props<{ data: { queues: QueueStatus[]; settings: AppSettings | null; error: string | null } }>();

  // Get valid queue names from the actual queues
  const validQueueNames = new Set(data.queues.map(q => q.name));

  // Filter saved excluded queues to only include valid ones
  const initialExcluded = (data.settings?.excludedQueues ?? []).filter(q => validQueueNames.has(q));

  // Local state for editable settings
  let thresholds = $state({
    default: data.settings?.thresholds.default ?? 300,
    faceDetection: data.settings?.thresholds.faceDetection ?? 300,
    facialRecognition: data.settings?.thresholds.facialRecognition ?? 300,
    thumbnailGeneration: data.settings?.thresholds.thumbnailGeneration ?? 120,
    metadataExtraction: data.settings?.thresholds.metadataExtraction ?? 180,
    videoConversion: data.settings?.thresholds.videoConversion ?? 1800,
  });

  let autoHealEnabled = $state(data.settings?.autoHeal.enabled ?? false);
  let excludedQueues = $state<Set<string>>(new Set(initialExcluded));
  let excludeDropdownOpen = $state(false);
  let saving = $state(false);
  let saveError = $state<string | null>(null);
  let saveSuccess = $state(false);

  function thresholdToMinutes(seconds: number): number {
    return Math.round(seconds / 60);
  }

  function minutesToThreshold(minutes: number): number {
    return minutes * 60;
  }

  function toggleExcludedQueue(queueName: string, event: Event) {
    event.stopPropagation();
    if (excludedQueues.has(queueName)) {
      excludedQueues.delete(queueName);
    } else {
      excludedQueues.add(queueName);
    }
    excludedQueues = new Set(excludedQueues);
  }

  function getExcludedLabel(): string {
    const count = excludedQueues.size;
    if (count === 0) return 'None';
    if (count === 1) return Array.from(excludedQueues)[0];
    return `${count} queues`;
  }

  async function saveSettings() {
    saving = true;
    saveError = null;
    saveSuccess = false;

    try {
      await updateSettings({
        thresholds,
        autoHeal: {
          enabled: autoHealEnabled,
          intervalSeconds: data.settings?.autoHeal.intervalSeconds ?? 60
        },
        excludedQueues: Array.from(excludedQueues)
      });
      saveSuccess = true;
      setTimeout(() => saveSuccess = false, 3000);
    } catch (e) {
      saveError = e instanceof Error ? e.message : 'Failed to save settings';
    } finally {
      saving = false;
    }
  }

  const thresholdFields = [
    { key: 'faceDetection' as const, label: 'Face Detection' },
    { key: 'facialRecognition' as const, label: 'Facial Recognition' },
    { key: 'thumbnailGeneration' as const, label: 'Thumbnail Generation' },
    { key: 'metadataExtraction' as const, label: 'Metadata Extraction' },
    { key: 'videoConversion' as const, label: 'Video Conversion' },
  ];
</script>

<div class="space-y-6">
  <div class="flex items-center justify-between">
    <div>
      <h1 class="text-2xl font-bold text-dark-50">Jobs Dashboard</h1>
      <p class="text-dark-400 mt-1">Monitor and manage Immich job queues</p>
    </div>
  </div>

  {#if data.error}
    <Alert color="danger">
      <div class="flex items-center gap-3">
        <Icon icon={mdiAlertCircle} size="20" />
        <span>{data.error}</span>
      </div>
    </Alert>
  {:else if data.queues.length === 0}
    <Card>
      <CardBody>
        <p class="text-dark-400">No queues available. Make sure the backend is connected to Immich.</p>
      </CardBody>
    </Card>
  {:else}
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {#each data.queues as queue}
        <a href="/queues/{encodeURIComponent(queue.name)}" class="block">
          <Card class="hover:border-primary-400 transition-colors h-full {queue.jobCounts.active > 0 ? 'bg-success-500/20 border-success-500/50' : ''}">
            <CardBody>
              <div class="flex items-center justify-between mb-3">
                <h3 class="font-semibold text-dark-50">{queue.name}</h3>
                {#if queue.isPaused}
                  <Badge color="warning">Paused</Badge>
                {:else if queue.jobCounts.active > 0}
                  <Badge color="success">Active</Badge>
                {:else}
                  <Badge color="secondary">Idle</Badge>
                {/if}
              </div>
              <div class="grid grid-cols-3 gap-2 text-sm">
                <div>
                  <p class="text-dark-400">Waiting</p>
                  <p class="text-dark-50 font-medium">{queue.jobCounts.waiting}</p>
                </div>
                <div>
                  <p class="text-dark-400">Active</p>
                  <p class="text-dark-50 font-medium">{queue.jobCounts.active}</p>
                </div>
                <div>
                  <p class="text-dark-400">Failed</p>
                  <p class="font-medium {queue.jobCounts.failed > 0 ? 'text-danger-500' : 'text-dark-50'}">{queue.jobCounts.failed}</p>
                </div>
              </div>
              {#if queue.stuckJobs && queue.stuckJobs.length > 0}
                <div class="mt-3 pt-3 border-t border-dark-700">
                  <p class="text-sm text-warning-500">
                    {queue.stuckJobs.length} stuck job{queue.stuckJobs.length !== 1 ? 's' : ''}
                  </p>
                </div>
              {/if}
            </CardBody>
          </Card>
        </a>
      {/each}
    </div>
  {/if}

  <!-- Job Settings Section -->
  {#if data.settings}
    <div class="pt-6 border-t border-dark-700">
      <div class="flex items-center justify-between mb-4">
        <div>
          <h2 class="text-xl font-bold text-dark-50">Stuck Job Detection</h2>
          <p class="text-dark-400 text-sm mt-1">Configure when jobs are considered stuck</p>
        </div>
        <Button
          size="small"
          color={saveSuccess ? 'success' : 'primary'}
          disabled={saving}
          onclick={saveSettings}
        >
          <Icon icon={mdiContentSave} size="16" class="mr-1" />
          {saving ? 'Saving...' : saveSuccess ? 'Saved!' : 'Save Changes'}
        </Button>
      </div>

      {#if saveError}
        <Alert color="danger" class="mb-4">
          <div class="flex items-center gap-3">
            <Icon icon={mdiAlertCircle} size="20" />
            <span>{saveError}</span>
          </div>
        </Alert>
      {/if}

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardBody>
            <h3 class="text-dark-50 font-semibold mb-4">General Settings</h3>
            <div class="space-y-4">
              <div class="flex items-center justify-between">
                <div>
                  <p class="text-dark-50">Default Threshold</p>
                  <p class="text-dark-400 text-sm">Time before a job is considered stuck</p>
                </div>
                <div class="flex items-center gap-2">
                  <input
                    type="number"
                    min="1"
                    max="120"
                    class="w-16 px-2 py-1 text-right bg-dark-700 border border-dark-600 rounded text-dark-50"
                    value={thresholdToMinutes(thresholds.default)}
                    onchange={(e) => thresholds.default = minutesToThreshold(parseInt(e.currentTarget.value) || 5)}
                  />
                  <span class="text-dark-400 text-sm">min</span>
                </div>
              </div>
              <div class="flex items-center justify-between">
                <div>
                  <p class="text-dark-50">Auto-Heal</p>
                  <p class="text-dark-400 text-sm">Automatically recover stuck jobs</p>
                </div>
                <label class="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    class="sr-only peer"
                    bind:checked={autoHealEnabled}
                  />
                  <div class="w-11 h-6 bg-dark-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-500"></div>
                </label>
              </div>
              <div>
                <div class="flex items-center justify-between">
                  <div>
                    <p class="text-dark-50">Excluded Queues</p>
                    <p class="text-dark-400 text-sm">Skip detection for long-running queues</p>
                  </div>
                  <button
                    type="button"
                    class="flex items-center gap-1 px-3 py-1.5 text-sm bg-dark-700 border border-dark-600 rounded text-dark-300 hover:border-dark-500 min-w-[100px] justify-between"
                    onclick={(e) => { e.stopPropagation(); excludeDropdownOpen = !excludeDropdownOpen; }}
                  >
                    <span class="truncate">{getExcludedLabel()}</span>
                    <Icon icon={mdiChevronDown} size="16" class="flex-shrink-0 transition-transform {excludeDropdownOpen ? 'rotate-180' : ''}" />
                  </button>
                </div>
                {#if excludeDropdownOpen}
                  <div class="flex flex-wrap gap-x-4 gap-y-1 mt-3 pt-3 border-t border-dark-700">
                    {#each data.queues as queue}
                      <label class="flex items-center gap-1.5 text-sm cursor-pointer hover:text-dark-50">
                        <input
                          type="checkbox"
                          checked={excludedQueues.has(queue.name)}
                          onchange={(e) => toggleExcludedQueue(queue.name, e)}
                          class="w-3.5 h-3.5 rounded border-dark-500 bg-dark-700 text-primary-500 focus:ring-primary-500"
                        />
                        <span class="text-dark-300">{queue.name}</span>
                      </label>
                    {/each}
                  </div>
                {/if}
              </div>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <h3 class="text-dark-50 font-semibold mb-4">Queue-Specific Thresholds</h3>
            <div class="space-y-3">
              {#each thresholdFields as field}
                <div class="flex items-center justify-between">
                  <p class="text-dark-400">{field.label}</p>
                  <div class="flex items-center gap-2">
                    <input
                      type="number"
                      min="1"
                      max="120"
                      class="w-16 px-2 py-1 text-right bg-dark-700 border border-dark-600 rounded text-dark-50"
                      value={thresholdToMinutes(thresholds[field.key])}
                      onchange={(e) => thresholds[field.key] = minutesToThreshold(parseInt(e.currentTarget.value) || 5)}
                    />
                    <span class="text-dark-400 text-sm">min</span>
                  </div>
                </div>
              {/each}
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  {/if}
</div>
