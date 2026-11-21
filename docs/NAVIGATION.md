# Navigation

Three levels, like the content: **Home** (`/`), **Chapter** (`/c/<id>`), **Game** (`/g/<slug>`).

- **Home** stays short: hero, one Continue card (the first built game you have not understood, in curriculum order), search across all games, then the ten chapters with progress. No 100 row lists.
- **Chapter** lists that chapter's playable games first, then the planned slots.
- **Game** header names its chapter as a link. The Menu button means Back: it returns to the screen you came from with its scroll position, or climbs to the chapter when the game was opened by a link. Next replaces the history entry, so it never stacks games.
- Scroll positions are kept per screen in the router (`useScrollMemory`) and only restored on Back, never on a fresh visit.
- Content starts below the iOS status bar blur zone: `max(safe-top, 20px) + 18..24px`.
