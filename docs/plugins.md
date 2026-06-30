# Plugins

Autonode can load **custom connectors** from plugins, so you can extend it
without forking. A plugin is just a module that exposes one or more connectors;
workflows then reference them by `type` like any built-in.

## Trust model

> ⚠️ **Loading a plugin executes its code.** A plugin's module body and its
> activator run in the same process as Autonode, with the same permissions.
> Only configure plugins you trust. Use `--no-plugins` on `run`, `schedule`, or
> `webhook` to run with built-in connectors only.

## Configuring plugins

List plugins in `autonode.config.json` (see [configuration.md](configuration.md)).
Each entry is either an installed package name or a path relative to the project
(the directory containing the config file):

```json
{
  "plugins": ["@acme/autonode-slack", "./plugins/my-connector.js"]
}
```

## Writing a plugin

A plugin module's default export is an `AutonodePlugin` object — or a function
that returns one. Use `definePlugin` from `@autonode/shared` for type-checking:

```ts
import { definePlugin } from '@autonode/shared';

export default definePlugin({
  name: 'greet-plugin',
  connectors: {
    // keyed by the step `type` workflows will use
    'greet.hello': async (config, _context) => {
      return { output: `Hello, ${config.who}!` };
    },
  },
});
```

Plain JavaScript works too:

```js
module.exports = {
  name: 'greet-plugin',
  connectors: {
    'greet.hello': async (config) => ({ output: `Hello, ${config.who}!` }),
  },
};
```

A connector receives the **interpolated** step config and the workflow context,
and returns a `StepResult` (typically `{ output: ... }`). Whatever it returns is
available to later steps via `{{ steps.<id>.output }}`.

### Using it in a workflow

```yaml
name: plugin-demo
steps:
  - id: greet
    type: greet.hello
    with:
      who: "Autonode"
  - id: show
    type: log
    with:
      message: "{{ steps.greet.output }}"
```

## Rules & behavior

- **Collisions are errors.** If a plugin connector's `type` matches a built-in
  or one already contributed by an earlier plugin, loading fails — there are no
  silent overrides.
- **Validation.** A plugin must export an object with a non-empty `name`, and
  every entry in `connectors` must be a function; otherwise loading fails with a
  descriptive error.
- **Inspecting.** `autonode plugins list` shows built-in connectors plus each
  configured plugin and the connectors it contributes.
- **Module format.** Plugins are resolved and required from the project root, so
  CommonJS modules and packages with a CommonJS entry point work out of the box.
