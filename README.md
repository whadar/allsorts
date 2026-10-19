# Allsorts

Two playful takes on the Wisconsin Card Sorting Test. In both, a hidden rule (color, shape,
or number) decides which of four piles a card belongs on. Six correct sorts in a row crack the
rule, and then it silently changes.

- **Card Sorter** (`index.html`): a card-table version with a dealer who deals, reacts and
  celebrates. Click a pile or press 1 to 4.
- **Sweet Sort** (`candy/index.html`): a candy-flavored version with glossy gems, stars, hearts
  and orbs. Drag the card from the middle toward a pile (up, down, left, right) and let go;
  a fast flick also works, and so do the arrow keys. No dealer, just micro-animations, a
  Sweet / Tasty / Delicious / Divine streak ladder, and an announcer voice.

  Levels (each unlocks the next; add `?unlock` to the URL to open them all):

  | Level | Name | Twist |
  |---|---|---|
  | 0 | Tutorial | Guided: the rule is shown, the right pile glows. Skippable. |
  | 1 | Sweet Start | Four correct in a row cracks a rule, three rules, with fanfare. |
  | 2 | Silent Switch | Rules change with no celebration, like the original test. |
  | 3 | Shifting Sands | Four rules, each needing a random 2 to 5 correct sorts before it changes. |
  | 4 | Sour Notes | Mistakes cost 15 points. |

  The announcer clips in `candy/voice/` were rendered with macOS `say` (Daniel voice); the
  browser's speech synthesis is used only if a clip fails to load.

No build step. Open `index.html` in a browser, or serve the folder:

```bash
node .claude/serve.js 8765
```

- **Keyboard:** `1`–`4` (Card Sorter) or arrow keys / WASD (Sweet Sort) to sort, `M` to mute, `Enter` to start.
- **Classic mode** (start screen toggle) hides the celebration when a rule is cracked, so rule
  changes are as unannounced as in the original test.
- **Tunables** live at the top of each `game.js`: run length, cards per rule, scoring, and for
  Sweet Sort the swipe distance and flick speed that commit a sort.
- Open either page with `?debug` to get a `window.cardSorter` / `window.sweetSort` handle for
  poking at the game from the console.
