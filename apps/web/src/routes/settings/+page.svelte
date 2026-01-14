<script lang="ts">
  import { Alert, Icon } from '@immich/ui';
  import { mdiAlertCircle } from '@mdi/js';

  let { data } = $props();

  function formatThreshold(seconds: number): string {
    if (seconds >= 60) {
      return `${Math.round(seconds / 60)} min`;
    }
    return `${seconds} sec`;
  }
</script>

<div class="space-y-6">
  <div>
    <h1 class="text-2xl font-bold text-dark-50 dark:text-dark-50 light:text-light-950">Settings</h1>
    <p class="text-dark-400 dark:text-dark-400 light:text-light-600 mt-1">Configure Immich Admin Tools</p>
  </div>

  {#if data.error}
    <Alert color="danger">
      <div class="flex items-center gap-3">
        <Icon icon={mdiAlertCircle} size="20" />
        <span>Error: {data.error}</span>
      </div>
    </Alert>
  {:else if data.settings}
    <div class="space-y-4">
      <div class="card">
        <h3 class="text-dark-50 dark:text-dark-50 light:text-light-950 font-semibold mb-4">Connection</h3>
        <div class="space-y-3">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-dark-50 dark:text-dark-50 light:text-light-950">Immich Server URL</p>
              <p class="text-dark-400 dark:text-dark-400 light:text-light-600 text-sm">Backend connection to Immich</p>
            </div>
            <div class="text-right">
              <p class="text-dark-400 dark:text-dark-400 light:text-light-600 text-sm">{data.settings.connection.immichUrl || 'Not configured'}</p>
              <span class="inline-flex items-center gap-1 text-sm {data.settings.connection.immichConnected ? 'text-success-500' : 'text-danger-500'}">
                <span class="w-2 h-2 rounded-full {data.settings.connection.immichConnected ? 'bg-success-500' : 'bg-danger-500'}"></span>
                {data.settings.connection.immichConnected ? 'Connected' : 'Disconnected'}
              </span>
            </div>
          </div>
          <div class="flex items-center justify-between">
            <div>
              <p class="text-dark-50 dark:text-dark-50 light:text-light-950">Redis Connection</p>
              <p class="text-dark-400 dark:text-dark-400 light:text-light-600 text-sm">Direct queue access</p>
            </div>
            <div class="text-right">
              <p class="text-dark-400 dark:text-dark-400 light:text-light-600 text-sm">{data.settings.connection.redisUrl || 'Not configured'}</p>
              <span class="inline-flex items-center gap-1 text-sm {data.settings.connection.redisConnected ? 'text-success-500' : 'text-danger-500'}">
                <span class="w-2 h-2 rounded-full {data.settings.connection.redisConnected ? 'bg-success-500' : 'bg-danger-500'}"></span>
                {data.settings.connection.redisConnected ? 'Connected' : 'Disconnected'}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div class="card">
        <h3 class="text-dark-50 dark:text-dark-50 light:text-light-950 font-semibold mb-4">Stuck Job Detection</h3>
        <div class="space-y-3">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-dark-50 dark:text-dark-50 light:text-light-950">Default Threshold</p>
              <p class="text-dark-400 dark:text-dark-400 light:text-light-600 text-sm">Time before a job is considered stuck</p>
            </div>
            <span class="text-dark-50 dark:text-dark-50 light:text-light-950">{formatThreshold(data.settings.thresholds.default)}</span>
          </div>
          <div class="flex items-center justify-between">
            <div>
              <p class="text-dark-50 dark:text-dark-50 light:text-light-950">Auto-Heal</p>
              <p class="text-dark-400 dark:text-dark-400 light:text-light-600 text-sm">Automatically recover stuck jobs</p>
            </div>
            <span class="text-dark-50 dark:text-dark-50 light:text-light-950">{data.settings.autoHeal.enabled ? `Enabled (${data.settings.autoHeal.intervalSeconds}s interval)` : 'Disabled'}</span>
          </div>
        </div>
      </div>

      <div class="card">
        <h3 class="text-dark-50 dark:text-dark-50 light:text-light-950 font-semibold mb-4">Queue-Specific Thresholds</h3>
        <div class="space-y-3">
          <div class="flex items-center justify-between">
            <p class="text-dark-400 dark:text-dark-400 light:text-light-600">Face Detection</p>
            <span class="text-dark-50 dark:text-dark-50 light:text-light-950">{formatThreshold(data.settings.thresholds.faceDetection)}</span>
          </div>
          <div class="flex items-center justify-between">
            <p class="text-dark-400 dark:text-dark-400 light:text-light-600">Facial Recognition</p>
            <span class="text-dark-50 dark:text-dark-50 light:text-light-950">{formatThreshold(data.settings.thresholds.facialRecognition)}</span>
          </div>
          <div class="flex items-center justify-between">
            <p class="text-dark-400 dark:text-dark-400 light:text-light-600">Thumbnail Generation</p>
            <span class="text-dark-50 dark:text-dark-50 light:text-light-950">{formatThreshold(data.settings.thresholds.thumbnailGeneration)}</span>
          </div>
          <div class="flex items-center justify-between">
            <p class="text-dark-400 dark:text-dark-400 light:text-light-600">Metadata Extraction</p>
            <span class="text-dark-50 dark:text-dark-50 light:text-light-950">{formatThreshold(data.settings.thresholds.metadataExtraction)}</span>
          </div>
          <div class="flex items-center justify-between">
            <p class="text-dark-400 dark:text-dark-400 light:text-light-600">Video Conversion</p>
            <span class="text-dark-50 dark:text-dark-50 light:text-light-950">{formatThreshold(data.settings.thresholds.videoConversion)}</span>
          </div>
        </div>
      </div>
    </div>
  {/if}
</div>
