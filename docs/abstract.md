# Slop Filter

Slop Filter is a browser extension and edge service that detects synthetic‑narrated slop in YouTube videos. It extracts audio, visual, and textual features from the media stream, scores them with a logistic regression model, and uses a Bloom filter backed by Cloudflare Workers KV to block or allow playback. The system is privacy‑first, storing annotations locally and providing a consent screen. Accessibility is ensured via ARIA attributes and keyboard navigation. The project follows a monorepo structure with shared libraries, CI, and a comprehensive evaluation plan.
