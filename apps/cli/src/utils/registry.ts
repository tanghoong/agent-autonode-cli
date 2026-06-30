/**
 * Single place every command obtains its connector registry.
 *
 * Today it returns the built-in connectors. It is intentionally the one seam
 * where connectors contributed by configured plugins will be merged once the
 * plugin loader lands (see docs/v0.3-scope.md, "Feature A"). Keeping every
 * command routed through here means that change is additive and localized.
 *
 * It is async so the future plugin loader (which dynamically imports modules)
 * can slot in without churning any call sites.
 */
import { createDefaultRegistry } from '@autonode/connectors';
import type { ConnectorRegistry } from '@autonode/engine';

export async function buildRegistry(): Promise<ConnectorRegistry> {
  const registry = createDefaultRegistry();
  // Plugin connectors are merged here in a later v0.3 release.
  return registry;
}
