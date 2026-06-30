# Configuration

Autonode reads an optional **`autonode.config.json`** file from your project.
It is discovered by starting in the current working directory and walking up
toward the filesystem root, so commands work from any subdirectory of a project.

`autonode init` scaffolds one for you. If no file is found, Autonode uses
sensible defaults (no plugins).

## Format

```json
{
  "plugins": []
}
```

| Field | Type | Default | Description |
|---|---|---|---|
| `plugins` | `string[]` | `[]` | npm package names or local module paths that contribute custom connectors. See [plugins.md](plugins.md). |

Unknown top-level keys are ignored. An invalid file (malformed JSON, or a
`plugins` value that is not an array of strings) fails fast with a descriptive
error rather than being silently ignored.

## Inspecting connectors and plugins

```bash
autonode plugins list
```

Lists every registered connector type and, if an `autonode.config.json` is
found, the plugin sources it declares.
