# Expansion Wars — Combined scale (schematic)

**Status:** not started. The folder holds copies of the three scales so that the combined mode can be revised here without changing the originals.

## Goal

One game in three zoom levels. The player zooms in from the country to a province, and from a province to a unit. Actions at each level change the state of the whole game: a battle at unit scale changes the province, and a province change changes the country. Each level runs at its own speed (time dilation), so the lower levels move slower or faster than the country turn clock.

## What is copied here

| Folder | Copied from | Role in combined |
|---|---|---|
| `country/` | `country/` | The top level: turns, diplomacy, nations. |
| `province/` | `province/` | The middle level: spots, soldiers, roads. |
| `unit/` | `V4/` (with `schematic.md`, `js/`, `tests/`) | The bottom level: the battle sandbox. |

The originals are untouched. Copies differ from the originals in only two ways:

1. **Shared files** are read from `../../shared/` (one level deeper than the originals).
2. **Saved data keys** are prefixed so the copies do not overwrite the originals' saves on the same device:
   - `combined_xw_maps_v1`, `combined_xw_progress_v1`, `combined_xw_scores_v1` (`country/js/store.js`, `province/js/store.js`)
   - `combined-expansion-wars-send-pct` (`country/js/country.js`)
   - `combined-xw4-replays` (`unit/js/replays.js`)

## Open decisions

- **Family database.** The copies still write to the shared Supabase tables `xw_maps` and `xw_replays`, so combined maps and replays appear beside the originals' records. Decide whether combined needs its own tables (a new migration in `supabase/`).
- **Time dilation.** How fast each level runs relative to the others. Not planned yet.
- **Linking.** How a unit battle feeds back into a province and a country. Not designed yet.
- **Entry point.** `index.html` is a placeholder page linking to the three copies. It is not linked from the home hub (`index.html` at the repo root).
