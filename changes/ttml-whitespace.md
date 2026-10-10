---
type: fix
impact: 2
highlight: false
---
Imported syllables no longer keep trailing spaces

Trailing spaces in imported TTML syllables are split into their own untimed word, so timed words stay clean and export keeps the spacing.
