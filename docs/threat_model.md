# Threat Model

- **Browser Extension**: Runs in the context of YouTube, can access video/audio streams and storage. Mitigations: only request necessary permissions, store data in `chrome.storage.sync` with encryption if needed.
- **Edge Service**: Exposes `/v1/bucket` and `/health`. Attack surface includes DoS, data leakage via Bloom filter queries. Mitigations: rate limiting, input validation, use of KV with proper key names.
- **Data Flow**: Features are generated client‑side, sent to edge worker, then Bloom filter lookup. No raw audio/video sent to third parties.

*This is a high‑level overview; detailed threat modeling will follow as the project matures.*
