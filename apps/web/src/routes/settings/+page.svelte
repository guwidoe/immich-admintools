<script lang="ts">
  import { Alert, Card, CardBody, Icon } from '@immich/ui';
  import { mdiAlertCircle } from '@mdi/js';

  let { data } = $props();
</script>

<div class="space-y-6">
  <div>
    <h1 class="text-2xl font-bold text-dark-50">Settings</h1>
    <p class="text-dark-400 mt-1">Connection status and configuration</p>
  </div>

  {#if data.error}
    <Alert color="danger">
      <div class="flex items-center gap-3">
        <Icon icon={mdiAlertCircle} size="20" />
        <span>Error: {data.error}</span>
      </div>
    </Alert>
  {:else if data.settings}
    <Card>
      <CardBody>
        <h3 class="text-dark-50 font-semibold mb-4">Connection</h3>
        <div class="space-y-3">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-dark-50">Immich Server URL</p>
              <p class="text-dark-400 text-sm">Backend connection to Immich</p>
            </div>
            <div class="text-right">
              <p class="text-dark-400 text-sm">{data.settings.connection.immichUrl || 'Not configured'}</p>
              <span class="inline-flex items-center gap-1 text-sm {data.settings.connection.immichConnected ? 'text-success-500' : 'text-danger-500'}">
                <span class="w-2 h-2 rounded-full {data.settings.connection.immichConnected ? 'bg-success-500' : 'bg-danger-500'}"></span>
                {data.settings.connection.immichConnected ? 'Connected' : 'Disconnected'}
              </span>
            </div>
          </div>
          <div class="flex items-center justify-between">
            <div>
              <p class="text-dark-50">Redis Connection</p>
              <p class="text-dark-400 text-sm">Direct queue access</p>
            </div>
            <div class="text-right">
              <p class="text-dark-400 text-sm">{data.settings.connection.redisUrl || 'Not configured'}</p>
              <span class="inline-flex items-center gap-1 text-sm {data.settings.connection.redisConnected ? 'text-success-500' : 'text-danger-500'}">
                <span class="w-2 h-2 rounded-full {data.settings.connection.redisConnected ? 'bg-success-500' : 'bg-danger-500'}"></span>
                {data.settings.connection.redisConnected ? 'Connected' : 'Disconnected'}
              </span>
            </div>
          </div>
        </div>
      </CardBody>
    </Card>

    <Card>
      <CardBody>
        <h3 class="text-dark-50 font-semibold mb-2">Configuration</h3>
        <p class="text-dark-400 text-sm">
          Job detection settings can be configured on the <a href="/" class="text-primary-400 hover:underline">Jobs Dashboard</a>.
          Connection settings are configured via environment variables.
        </p>
      </CardBody>
    </Card>
  {/if}
</div>
