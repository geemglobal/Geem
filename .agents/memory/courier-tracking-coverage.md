---
name: Courier tracking coverage
description: Provider verification boundary for live shipment status lookups
---

Live shipment tracking must stay server-side and return a compact structured response; the browser should retain an official-source link as the fallback.

**Why:** Courier pages differ in authentication, JavaScript rendering, and response shape. Parsing an unverified flow can silently show stale or incorrect shipment states.

**How to apply:** Leopards is the currently verified live parser. TCS, M&P, and Trax should remain official-link fallbacks until each official endpoint or page flow is verified with a representative shipment.