import { WorkflowContext, StepResult } from './types';

/**
 * A connector implementation: given an interpolated step config and the current
 * workflow context, it performs an action and returns a result. This mirrors the
 * engine's internal connector signature so plugin authors can depend only on
 * `@autonode/shared`.
 */
export type ConnectorFn = (
  config: Record<string, unknown>,
  context: WorkflowContext
) => Promise<StepResult>;

/**
 * The contract an Autonode plugin module exposes. A plugin contributes one or
 * more named connectors that workflows can then reference by `type`.
 *
 * A plugin module's default export is either an `AutonodePlugin` object or a
 * zero-arg function that returns one (a `PluginActivator`).
 */
export interface AutonodePlugin {
  /** Human-readable plugin name, used in diagnostics and `plugins list`. */
  name: string;
  /** Connectors contributed by this plugin, keyed by step `type`. */
  connectors?: Record<string, ConnectorFn>;
}

export type PluginActivator = () => AutonodePlugin;

/**
 * Identity helper that gives plugin authors type-checking and editor
 * completions when declaring a plugin:
 *
 * ```ts
 * import { definePlugin } from '@autonode/shared';
 * export default definePlugin({ name: 'my-plugin', connectors: { ... } });
 * ```
 */
export function definePlugin(plugin: AutonodePlugin): AutonodePlugin {
  return plugin;
}
