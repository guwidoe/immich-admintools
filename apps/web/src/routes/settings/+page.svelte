<script lang="ts">
  import { onMount } from 'svelte';
  import { Alert, Card, CardBody, Icon } from '@immich/ui';
  import { mdiAlertCircle } from '@mdi/js';

  interface SettingsResponse {
    connection: {
      immichUrl: string;
      immichConnected: boolean;
      redisUrl: string;
      redisConnected: boolean;
    };
  }

  let loading = $state(true);
  let error = $state<string | null>(null);
  let settings = $state<SettingsResponse | null>(null);

  onMount(async () => {
    try {
      const response = await fetch('/api/health/settings');
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      settings = await response.json();
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to load settings';
    } finally {
      loading = false;
    }
  });
</script>

<div class="space-y-6">
  <div>
    <h1 class="text-2xl font-bold text-dark-50">Settings</h1>
    <p class="text-dark-400 mt-1">Connection status and configuration</p>
  </div>

  {#if error}
    <Alert color="danger">
      <div class="flex items-center gap-3">
        <Icon icon={mdiAlertCircle} size="20" />
        <span>Error: {error}</span>
      </div>
    </Alert>
  {/if}

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
            <p class="text-dark-400 text-sm">{settings?.connection.immichUrl || 'Not configured'}</p>
            {#if loading}
              <span class="inline-flex items-center gap-1 text-sm text-dark-400">
                <span class="w-2 h-2 rounded-full bg-dark-400 animate-pulse"></span>
                Checking...
              </span>
            {:else}
              <span class="inline-flex items-center gap-1 text-sm {settings?.connection.immichConnected ? 'text-success-500' : 'text-danger-500'}">
                <span class="w-2 h-2 rounded-full {settings?.connection.immichConnected ? 'bg-success-500' : 'bg-danger-500'}"></span>
                {settings?.connection.immichConnected ? 'Connected' : 'Disconnected'}
              </span>
            {/if}
          </div>
        </div>
        <div class="flex items-center justify-between">
          <div>
            <p class="text-dark-50">Redis Connection</p>
            <p class="text-dark-400 text-sm">Direct queue access</p>
          </div>
          <div class="text-right">
            <p class="text-dark-400 text-sm">{settings?.connection.redisUrl || 'Not configured'}</p>
            {#if loading}
              <span class="inline-flex items-center gap-1 text-sm text-dark-400">
                <span class="w-2 h-2 rounded-full bg-dark-400 animate-pulse"></span>
                Checking...
              </span>
            {:else}
              <span class="inline-flex items-center gap-1 text-sm {settings?.connection.redisConnected ? 'text-success-500' : 'text-danger-500'}">
                <span class="w-2 h-2 rounded-full {settings?.connection.redisConnected ? 'bg-success-500' : 'bg-danger-500'}"></span>
                {settings?.connection.redisConnected ? 'Connected' : 'Disconnected'}
              </span>
            {/if}
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
</div>
