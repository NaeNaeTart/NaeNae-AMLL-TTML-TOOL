# Third-party notices

## Spicy Lyrics renderer

`src/components/SpicyLyrics/` adapts the rendering behavior and Spring implementation from [Spicy Lyrics](https://github.com/Spikerko/Spicy-Lyrics), Copyright (C) Spikerko and contributors, licensed under AGPL-3.0-or-later. The adapted files retain their origin notice and are distributed under the root AGPL-3.0-or-later license.

The renderer also bundles the `SpicyLyrics` font files supplied by the Spicy Lyrics public font endpoint at `https://fonts.spikerko.org/spicy-lyrics/`.

## Fraktality spring

The analytic spring implementation originated from Fraktality's `spr.lua`, licensed under the MIT License, as noted in the adapted source.

## Prosodic syllabification engine

The Prosodic syllabification engine and bundled
`src/modules/segmentation/data/prosodic-dict.json` are adapted from
[amll-dev/amll-editor](https://github.com/amll-dev/amll-editor), licensed
under GNU AGPL-3.0-only. The engine uses its generated
`SUBTLEXus_prosotic.dict.json` dictionary for English syllable boundaries.
