<script lang="ts">
  import '../app.css';
  import { page } from '$app/stores';
  import { fetchHealth } from '$lib/api/client';
  import type { Snippet } from 'svelte';

  let { children }: { children: Snippet } = $props();

  let currentPath = $derived($page.url.pathname);
  let status = $state<'ok' | 'degraded' | 'error' | 'checking' | 'unknown'>('checking');

  const navItems = [
    { href: '/', label: 'Dashboard', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
    { href: '/history', label: 'History', icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z' },
    { href: '/settings', label: 'Settings', icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z' }
  ];

  function isActive(href: string): boolean {
    if (href === '/') {
      return currentPath === '/';
    }
    return currentPath.startsWith(href);
  }

  function getStatusColor(s: string): string {
    switch (s) {
      case 'ok':
        return 'bg-green-500';
      case 'degraded':
        return 'bg-yellow-500';
      case 'error':
        return 'bg-red-500';
      case 'checking':
        return 'bg-blue-500 animate-pulse';
      default:
        return 'bg-gray-500';
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

  // Use $effect for setup and cleanup in Svelte 5
  $effect(() => {
    checkHealth();
    const pollInterval = setInterval(checkHealth, 30000);

    return () => {
      clearInterval(pollInterval);
    };
  });
</script>

<div class="flex h-screen">
  <!-- Sidebar -->
  <aside class="w-64 bg-immich-dark-card border-r border-immich-dark-border flex flex-col">
    <!-- Logo/Title -->
    <div class="p-4 border-b border-immich-dark-border">
      <h1 class="text-xl font-bold text-white">Immich Admin Tools</h1>
      <p class="text-sm text-immich-dark-muted mt-1">Queue Management</p>
    </div>

    <!-- Navigation -->
    <nav class="flex-1 p-4 space-y-2">
      {#each navItems as item}
        <a
          href={item.href}
          class="nav-link"
          class:active={isActive(item.href)}
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d={item.icon} />
          </svg>
          {item.label}
        </a>
      {/each}
    </nav>

    <!-- Connection Status -->
    <div class="p-4 border-t border-immich-dark-border">
      <div class="flex items-center gap-2">
        <div class="w-2 h-2 rounded-full {getStatusColor(status)}"></div>
        <span class="text-sm text-immich-dark-muted">
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
  <main class="flex-1 overflow-auto">
    <!-- Header -->
    <header class="h-16 bg-immich-dark-card border-b border-immich-dark-border flex items-center px-6">
      <h2 class="text-lg font-semibold text-white">
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
    </header>

    <!-- Page Content -->
    <div class="p-6">
      {@render children()}
    </div>
  </main>
</div>
