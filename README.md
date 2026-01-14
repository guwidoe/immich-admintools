# Immich Admin Tools

<p align="center">
  <strong>🔧 Enhanced job queue management and monitoring for Immich</strong>
</p>

<p align="center">
  <em>More transparency. More control. Less stuck jobs.</em>
</p>

---

> ⚠️ **Work in Progress** - This project is currently in the planning/early development phase. See [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md) for the full roadmap.

## The Problem

If you run [Immich](https://immich.app/) with a large photo library (100k+ photos), you've likely experienced:

- **Stuck jobs** - Jobs show as "active" for hours without completing
- **Silent failures** - No indication of *why* processing stopped
- **Manual recovery** - Having to run Redis CLI commands to clear zombie jobs
- **Poor visibility** - Can't see which files are causing problems or get processing ETAs

This happens because BullMQ (Immich's job queue) marks jobs as "active" when a worker picks them up, but if that worker hangs (corrupted file, memory issue, unexpected restart), the job stays "active" forever—eventually blocking the entire queue.

## The Solution

**Immich Admin Tools** is a companion dashboard that provides:

| Feature | Description |
|---------|-------------|
| **📊 Real-time Dashboard** | Live queue status with processing rates and ETAs |
| **🔍 Stuck Job Detection** | Automatically detect jobs running longer than expected |
| **⚡ One-Click Recovery** | Clear stuck jobs without touching Redis CLI |
| **📁 Asset Identification** | See exactly which files are causing problems |
| **🔄 Auto-Heal Mode** | Optionally auto-clear stuck jobs |
| **🔔 Alerts** | Webhook notifications when things go wrong |

## Screenshots

*Coming soon*

## Quick Start

```yaml
# Add to your docker-compose.yml
services:
  immich-admin-tools:
    image: ghcr.io/your-org/immich-admin-tools:latest
    container_name: immich_admin_tools
    environment:
      - IMMICH_API_URL=http://immich_server:2283
      - IMMICH_API_KEY=${IMMICH_API_KEY}
      - REDIS_URL=redis://immich_redis:6379
    ports:
      - "2285:3000"
    depends_on:
      - immich_server
      - immich_redis
```

Then visit `http://localhost:2285`

## Requirements

- Immich v2.4.0+ (uses the new `/queues` API)
- Docker
- An Immich API key (generate in Immich: Profile → API Keys)

## Tech Stack

Built to feel native to Immich:

- **Frontend**: SvelteKit + [@immich/ui](https://ui.immich.app)
- **Backend**: NestJS (TypeScript)
- **API**: [@immich/sdk](https://www.npmjs.com/package/@immich/sdk)
- **Styling**: Tailwind CSS

## Roadmap

- [x] Planning & architecture
- [ ] **Phase 1**: Core dashboard + stuck job recovery
- [ ] **Phase 2**: Job history & statistics
- [ ] **Phase 3**: Auto-heal mode + notifications
- [ ] **Phase 4**: Problem asset management

See [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md) for detailed specifications.

## Contributing

This project is in early development. Contributions welcome!

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Why a Separate Tool?

This is **not** intended to become an official Immich feature. Instead, it serves as:

1. **A reference implementation** - Shows how job management problems can be solved
2. **Inspiration for Immich devs** - Ideas they can study when tackling these issues natively
3. **Immediate relief** - Users get a solution *now* instead of waiting for core fixes
4. **Proof of concept** - Demonstrates the value of proper stuck job detection

If Immich eventually implements native stalled job detection (via BullMQ's built-in features), this tool becomes less necessary—and that's a win for everyone.

## Related Resources

- [Immich](https://immich.app/) - The photo management solution
- [GitHub Issue #22180](https://github.com/immich-app/immich/issues/22180) - Job timeout feature request
- [Immich Power Tools](https://github.com/varun-raj/immich-power-tools) - Bulk photo management (different scope)

## License

This project is licensed under the AGPL-3.0 License - see the [LICENSE](LICENSE) file for details.

This is the same license as Immich itself, ensuring compatibility.

---

<p align="center">
  Made with ❤️ by the Immich community
</p>
