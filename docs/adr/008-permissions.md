# ADR 008: Permissions

Every manifest permission and host pattern, and why it is the minimum that works.

| Entry | Why | If removed |
|---|---|---|
| `storage` | Settings, annotations, feedback, feature config override — all in `chrome.storage.local`. IndexedDB holds the verdict cache. | Nothing can persist; the filter would have to re-ask for consent on every page. |
| `activeTab` | The "Analyze this video" button sends a message to the tab the user is looking at, only after a click. | Analysis would need a broader `tabs` permission or a permanent content-script bridge. |
| host `https://www.youtube.com/*` | The content script must run on watch/Shorts pages to read the `<video>` element. | No detection at all. |
| `optional_host_permissions: https://*/*` | Needed only if the user configures an edge origin. Requested at save time via `chrome.permissions.request`, scoped to that origin. | Edge corroboration unavailable; fully-offline mode unaffected. |

Deliberately **not** requested:

- `tabCapture` — audio comes from `createMediaElementSource`, not tab capture. Whole-tab capture would be a far larger disclosure.
- `tabs` — `activeTab` covers the single case we need.
- `scripting` — the content script is declared statically; nothing is injected at runtime.
- `<all_urls>` — the filter is YouTube-only by design.

CSP: `script-src 'self'; object-src 'self'` for extension pages — no `unsafe-eval`, no remote script.

Network: with `edgeOrigin` empty (the default) the extension makes **no** network requests at all.