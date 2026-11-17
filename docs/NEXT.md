# Next: the other four opening games

Dominant Strategy ships first. Their pure models and tests already exist in `src/games/<slug>/model.ts` and pass, but they have no game class and are not registered. They appear as empty slots 002 to 005.

All four follow Feel, See, Prove. Visual grammar: you are the disc, they are the ring, payoff is area.

## 002 Prisoner's Dilemma (`prisoners-dilemma`)

- **Feel**: three rounds against three strangers. Choose Hold (closed ring) or Break (ring with a gap). Two discs show your payoff and theirs. A dashed ring shows what the other move would have paid. Payoffs 5, 3, 1, 0.
- **See**: a plane of the four outcomes (your payoff on x, theirs on y). Tap "They hold" then "They break" and an arrow shows Break pays more in both. Then the region up and right of "both break" is shaded: both would prefer "both hold".
- **Prove**: drag the temptation disc (Break against Hold, 5) down. Once it falls below the reward (3), Hold becomes the best reply to Hold and the dilemma disappears. Takeaway links to Stag Hunt.

## 003 Matching Pennies (`matching-pennies`)

- **Feel**: 16 rounds. Tap Left or Right. A pattern reader (`PatternPredictor`) guesses before it sees you. A vertical timeline shows your dot per round and its ring, circled when it caught you.
- **See**: how often it caught you, your repeat rates after Left and Right, and the tent chart of expected score against how far you lean from 50/50.
- **Prove**: ten rounds using a Flip pad (a real random choice), then a 1000 round simulation drawn as a running accuracy line that settles at one half.

## 004 Stag Hunt (`stag-hunt`)

- **Feel**: five partners, each shown as a ring with ten notches filled by how often they hunted stag. Choose Stag (large disc) or Hare (small disc).
- **See**: x is your belief the partner hunts stag, y is payoff. Hare is a flat line at 2, Stag is the line 3p. They cross at 2/3. Your five choices are plotted on the lines, wrong ones marked.
- **Prove**: new payoffs. Drag a marker to the belief where you would switch (hare over stag), then lock in. The lines are revealed after. Tolerance 0.07.

## 005 Ultimatum (`ultimatum`)

- **Feel**: five responders. Drag the divider to split 10 coins, tap Offer. Accept keeps the split, reject dissolves it. A scatter of offers fills in.
- **See**: acceptance curve and your expected earnings curve against the offer. Drag a probe to find the peak near 4.5. The textbook offer of 1 is marked and rarely accepted.
- **Prove**: a generous crowd and a demanding crowd. Pick the offer that earns the most on average. Pass at 94 percent of the best.

## Then

Everything after 005 is empty slots in curriculum order. Synthesis capstones come last: Frames Within Frames and The Whole Board.
