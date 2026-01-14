<script lang="ts">
  // History page - placeholder for job history feature
</script>

<div class="space-y-6">
  <div>
    <h1 class="text-2xl font-bold text-white">Job History</h1>
    <p class="text-immich-dark-muted mt-1">View completed and failed job history</p>
  </div>

  <div class="card border-dashed">
    <div class="text-center py-8">
      <svg class="w-12 h-12 mx-auto text-immich-dark-muted mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <h2 class="text-lg font-semibold text-white mb-2">Coming Soon</h2>
      <p class="text-immich-dark-muted max-w-md mx-auto">
        Job history tracking will allow you to view completed jobs, investigate failures, and monitor processing trends over time.
      </p>
    </div>
  </div>

  <!-- Placeholder sections for future implementation -->
  <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
    <div class="card">
      <h3 class="text-white font-medium mb-2">Completed Jobs</h3>
      <p class="text-3xl font-bold text-green-400">--</p>
      <p class="text-immich-dark-muted text-sm">Last 24 hours</p>
    </div>
    <div class="card">
      <h3 class="text-white font-medium mb-2">Failed Jobs</h3>
      <p class="text-3xl font-bold text-red-400">--</p>
      <p class="text-immich-dark-muted text-sm">Last 24 hours</p>
    </div>
    <div class="card">
      <h3 class="text-white font-medium mb-2">Avg. Processing Time</h3>
      <p class="text-3xl font-bold text-white">--</p>
      <p class="text-immich-dark-muted text-sm">Per job</p>
    </div>
  </div>
</div>
