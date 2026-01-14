<script lang="ts">
  import '../app.css';
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { fetchHealth } from '$lib/api/client';
  import type { Snippet } from 'svelte';
  import { initializeTheme, ThemeSwitcher, Logo, TooltipProvider } from '@immich/ui';
  import { mdiViewDashboard, mdiHistory, mdiCog } from '@mdi/js';
  import SideBarLink from '$lib/components/SideBarLink.svelte';

  let { children }: { children: Snippet } = $props();

  let currentPath = $derived($page.url.pathname);
  let status = $state<'ok' | 'degraded' | 'error' | 'checking' | 'unknown'>('checking');
  let mounted = $state(false);

  const navItems = [
    { href: '/', title: 'Dashboard', icon: mdiViewDashboard },
    { href: '/history', title: 'History', icon: mdiHistory },
    { href: '/settings', title: 'Settings', icon: mdiCog }
  ];

  function getStatusColor(s: string): string {
    switch (s) {
      case 'ok':
        return 'bg-success-500';
      case 'degraded':
        return 'bg-warning-500';
      case 'error':
        return 'bg-danger-500';
      case 'checking':
        return 'bg-info-500 animate-pulse';
      default:
        return 'bg-dark-500';
    }
  }

  async function checkHealth() {
    try {
      const health = await fetchHealth();
      status = health.status;
    } catch {
      status = 'error';
    }
  }

  onMount(() => {
    mounted = true;
    initializeTheme({ selector: 'html' });
    checkHealth();
    const pollInterval = setInterval(checkHealth, 30000);

    return () => {
      clearInterval(pollInterval);
    };
  });
</script>

<TooltipProvider>
<div class="flex h-screen">
  <!-- Sidebar -->
  <aside class="w-64 flex flex-col h-full justify-between">
    <div class="flex flex-col pt-4 pe-4 gap-1">
      <!-- Logo/Title -->
      <div class="flex items-center gap-3 px-5 pb-4">
        {#if mounted}
          <div class="w-10 h-10 flex-shrink-0 [&_svg]:w-full [&_svg]:h-full">
            <Logo variant="icon" size="tiny" />
          </div>
        {/if}
        <div>
          <h1 class="text-lg font-bold">Admin Tools</h1>
          <p class="text-xs text-gray-500 dark:text-gray-400">Queue Management</p>
        </div>
      </div>

      <!-- Navigation -->
      {#each navItems as item}
        <SideBarLink
          title={item.title}
          href={item.href}
          icon={item.icon}
        />
      {/each}
    </div>

    <!-- Connection Status -->
    <div class="mb-4 me-4 px-5 py-3">
      <div class="flex items-center gap-2">
        <div class="w-2 h-2 rounded-full {getStatusColor(status)}"></div>
        <span class="text-sm text-gray-500 dark:text-immich-dark-fg">
          {#if status === 'ok'}
            Connected
          {:else if status === 'checking'}
            Checking...
          {:else if status === 'error'}
            Disconnected
          {:else if status === 'degraded'}
            Degraded
          {:else}
            Unknown
          {/if}
        </span>
      </div>
    </div>
  </aside>

  <!-- Main Content -->
  <main class="flex-1 overflow-auto bg-immich-gray dark:bg-immich-dark-bg">
    <!-- Header -->
    <header class="h-16 border-b flex items-center justify-between px-6">
      <h2 class="text-lg font-semibold">
        {#if currentPath === '/'}
          Dashboard
        {:else if currentPath.startsWith('/queues/')}
          Queue Details
        {:else if currentPath === '/history'}
          Job History
        {:else if currentPath === '/settings'}
          Settings
        {:else}
          Immich Admin Tools
        {/if}
      </h2>
      {#if mounted}
        <div class="[&_svg]:w-6 [&_svg]:h-6">
          <ThemeSwitcher size="small" />
        </div>
      {/if}
    </header>

    <!-- Page Content -->
    <div class="p-6">
      {@render children()}
    </div>
  </main>
</div>
</TooltipProvider>
