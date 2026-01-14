<script lang="ts">
  let { data } = $props();

  $inspect(data);

  function formatThreshold(seconds: number): string {
    if (seconds >= 60) {
      return `${Math.round(seconds / 60)} min`;
    }
    return `${seconds} sec`;
  }
</script>

<div class="space-y-6">
  <div>
    <h1 class="text-2xl font-bold text-white">Settings</h1>
    <p class="text-immich-dark-muted mt-1">Configure Immich Admin Tools</p>
  </div>

  {#if data.error}
    <div class="card border-red-500">
      <p class="text-red-400">Error: {data.error}</p>
    </div>
  {:else if data.settings}
    <div class="space-y-4">
      <div class="card">
        <h3 class="text-white font-semibold mb-4">Connection</h3>
        <div class="space-y-3">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-white">Immich Server URL</p>
              <p class="text-immich-dark-muted text-sm">Backend connection to Immich</p>
            </div>
            <div class="text-right">
              <p class="text-immich-dark-muted text-sm">{data.settings.connection.immichUrl || 'Not configured'}</p>
              <span class="inline-flex items-center gap-1 text-sm {data.settings.connection.immichConnected ? 'text-green-400' : 'text-red-400'}">
                <span class="w-2 h-2 rounded-full {data.settings.connection.immichConnected ? 'bg-green-400' : 'bg-red-400'}"></span>
                {data.settings.connection.immichConnected ? 'Connected' : 'Disconnected'}
              </span>
            </div>
          </div>
          <div class="flex items-center justify-between">
            <div>
              <p class="text-white">Redis Connection</p>
              <p class="text-immich-dark-muted text-sm">Direct queue access</p>
            </div>
            <div class="text-right">
              <p class="text-immich-dark-muted text-sm">{data.settings.connection.redisUrl || 'Not configured'}</p>
              <span class="inline-flex items-center gap-1 text-sm {data.settings.connection.redisConnected ? 'text-green-400' : 'text-red-400'}">
                <span class="w-2 h-2 rounded-full {data.settings.connection.redisConnected ? 'bg-green-400' : 'bg-red-400'}"></span>
                {data.settings.connection.redisConnected ? 'Connected' : 'Disconnected'}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div class="card">
        <h3 class="text-white font-semibold mb-4">Stuck Job Detection</h3>
        <div class="space-y-3">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-white">Default Threshold</p>
              <p class="text-immich-dark-muted text-sm">Time before a job is considered stuck</p>
            </div>
            <span class="text-white">{formatThreshold(data.settings.thresholds.default)}</span>
          </div>
          <div class="flex items-center justify-between">
            <div>
              <p class="text-white">Auto-Heal</p>
              <p class="text-immich-dark-muted text-sm">Automatically recover stuck jobs</p>
            </div>
            <span class="text-white">{data.settings.autoHeal.enabled ? `Enabled (${data.settings.autoHeal.intervalSeconds}s interval)` : 'Disabled'}</span>
          </div>
        </div>
      </div>

      <div class="card">
        <h3 class="text-white font-semibold mb-4">Queue-Specific Thresholds</h3>
        <div class="space-y-3">
          <div class="flex items-center justify-between">
            <p class="text-immich-dark-muted">Face Detection</p>
            <span class="text-white">{formatThreshold(data.settings.thresholds.faceDetection)}</span>
          </div>
          <div class="flex items-center justify-between">
            <p class="text-immich-dark-muted">Facial Recognition</p>
            <span class="text-white">{formatThreshold(data.settings.thresholds.facialRecognition)}</span>
          </div>
          <div class="flex items-center justify-between">
            <p class="text-immich-dark-muted">Thumbnail Generation</p>
            <span class="text-white">{formatThreshold(data.settings.thresholds.thumbnailGeneration)}</span>
          </div>
          <div class="flex items-center justify-between">
            <p class="text-immich-dark-muted">Metadata Extraction</p>
            <span class="text-white">{formatThreshold(data.settings.thresholds.metadataExtraction)}</span>
          </div>
          <div class="flex items-center justify-between">
            <p class="text-immich-dark-muted">Video Conversion</p>
            <span class="text-white">{formatThreshold(data.settings.thresholds.videoConversion)}</span>
          </div>
        </div>
      </div>
    </div>
  {/if}
</div>
