# NaeNae's AMLL TTML Tool Fork Plugin Overview / Development Guide (WIP)

Due to growing diverse requirements and to keep the tool itself from becoming too bloated and complex while satisfying special needs in more scenarios, a set of lyric tool plugin interface specifications for NaeNae's AMLL TTML Tool Fork has been established to meet the special needs of lyric creators as much as possible.

## Overview

Plugins are implemented based on the Extism plugin framework, allowing development in multiple languages and compiled to WASM for use by NaeNae's AMLL TTML Tool Fork. For details, refer to the [Extism official website](https://extism.org/).

The following features are expected to be available:

- Access to all lyric data, with the ability to view and modify lyrics and create edit history points (for undo/redo).
- Listen to various user lyric operation events (editing words, setting timestamps (timing)).
- Create extension dropdown menu items with callbacks for user interaction.
- Display form inputs to users for more customizable operation configurations.
- Display notification boxes and progress bars to keep users informed of the current operation status.

## Function Prototype Description Explanation

According to the Extism architecture, the interface documentation describes functions in the following format:

```
ReturnValue FunctionName(Parameters)
```

Unless otherwise specified, return values and parameters are JSON strings, and the data structures for JSON objects are detailed later.

### Data Types

- `i8`, `i16`, `i32`, `i64`, `u8`, `u16`, `u32`, `u64` - Common integer numeric types.
- `String` - A pointer to a string, terminated with a NULL null value.
- Types other than the above (e.g., `LyricLine`) - Data structures stored as JSON strings.
- Types with **square brackets** (e.g., `LyricLine[]`) - **Array** data structures stored as JSON strings.

## Plugin Function Definitions

### Plugin Lifecycle Functions

All of the following functions must be defined:

| Function Prototype            | Required | Description                                                                 |
| ----------------------------- | -------- | --------------------------------------------------------------------------- |
| `void plugin_on_load(void)`   | `true`   | Called when the plugin is loaded. This is the first function called.        |
| `void plugin_on_unload(void)` | `true`   | Called when the plugin is unloaded. This is the last function called.       |

### Plugin Event Functions

The following functions are optional. NaeNae's AMLL TTML Tool Fork will automatically call them based on whether the function definition is registered.

| Function Prototype                             | Required | Description                                                                                                   |
| ---------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------- |
| `void event_on_lyric_update(LyricUpdateEvent)` | `false`  | Triggered when the user operates any lyric data (does not include modifications to lyrics from plugins).      |
| `void event_on_undo(void)`                     | `false`  | Triggered when the user performs an undo operation.                                                           |
| `void event_on_redo(void)`                     | `false`  | Triggered when the user performs a redo operation.                                                           |
| `void event_on_click_plugin_menu_item(String)` | `false`  | Triggered when the user clicks a menu item in the plugin menu. Parameter is the string menu ID defined at registration. |

## Host Function Definitions

The following host functions can be called within any plugin function definition as needed to achieve required extended functionality.

### Lyric Editing Related

| Function Prototype            | Description                                                                              |
| ----------------------------- | ---------------------------------------------------------------------------------------- |
| `LyricLine[] lyric_get(void)` | Get the full text data of the current lyrics. Returns a JSON string representing `LyricLine[]`. |
| `void lyric_set(LyricLine[])` | Set the lyric data currently being edited. Parameter is a JSON string representing `LyricLine[]`. |
| `void lyric_record(void)`     | Record a snapshot of the current lyric editing state for user undo/redo operations.      |

### Extension Menu Related

| Function Prototype | Description      |
| ------------------ | ---------------- |
| `void menu_new()`  | Create a new menu |

## Data Structures

### `LyricUpdateEvent`

| Field Name  | Field Type | Description                                     |
| ----------- | ---------- | ----------------------------------------------- |
| `lineIndex` | `u64`      | Index of the lyric line updated by the user.    |
| `wordIndex` | `u64`      | Index of the word updated by the user.          |

### `LyricLine`

| Field Name        | Field Type    | Description                                              |
| ----------------- | ------------- | -------------------------------------------------------- |
| `words`           | `LyricWord[]` | All words in this line.                                  |
| `translatedLyric` | `String`      | Translated lyrics for this line.                         |
| `romanLyric`      | `String`      | Transliterated (romanized) lyrics for this line.         |
| `isBG`            | `boolean`     | Whether this line is a background lyric line.            |
| `isDuet`          | `boolean`     | Whether this line is a duet line (right-aligned).        |
| `startTime`       | `u64`         | Start time of the line (milliseconds).                   |
| `endTime`         | `u64`         | End time of the line (milliseconds).                     |

### `LyricWord`

| Field Name  | Field Type | Description                               |
| ----------- | ---------- | ----------------------------------------- |
| `word`      | `String`   | Text content of the word.                 |
| `startTime` | `u64`      | Start time of the word (milliseconds).    |
| `endTime`   | `u64`      | End time of the word (milliseconds).      |
| `emptyBeat` | `u64`      | Number of empty beats for the word.       |
