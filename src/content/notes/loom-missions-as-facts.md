---
title: "Loom: describing a mission as facts, so a fleet can finish it without a commander"
description: "A small language for drone missions that never names an aircraft. What it compiles to, what the compiler refuses to let you write, and what it still cannot promise."
date: 2026-10-02
tags: ["Robotics", "Swarm", "Languages", "Autonomy", "Loom"]
placeholder: false
draft: false
---

Flying one drone from a script is a solved problem. A fleet is not, because three things happen that a script cannot survive: aircraft fail or fall out of radio range in the middle of the mission, aircraft join while it runs and have to catch up, and the link to the operator drops.

Loom is our answer to the question *what do you write down so that none of those matters?* It is a small language and a compiler (`loomc`). It runs on the ground, at authoring time, and produces **data**: a bundle of goals that every aircraft holds a copy of. Nothing in it is a command, and nothing in it names an aircraft.

This note is adapted from the Loom book, a hands-on coding book whose every program is compiled by the real `loomc` when the book is built. The outputs below are the compiler's actual outputs.

<figure class="diagram-block">
  <img src="/assets/notes/loom/stack.png" alt="Where Loom sits in the stack" loading="lazy" style="width:100%;height:auto;border-radius:6px;border:1px solid var(--border)" />
  <figcaption>Loom is compiled on the ground. Everything below it runs on every aircraft, with no ground link required: a shared world, an auction, a planner, an action library, and the autopilot (PX4 or INAV) left untouched.</figcaption>
</figure>

## Facts, not orders

The central idea is that a mission is a set of **desired facts**. "The ridge is scanned" is a fact. "Drone B scans the ridge" is an order, and an order breaks the moment drone B does.

Here is a whole mission:

```
mission chain (v1, settle 5s, budget 6KB) {
  grants {
    self.msv_chain_v1_* : register<set> by mark_done
  }

  milestone scan_a:
    means scan(lat=43.530, lon=5.450)
    emits msv_chain_v1_a

  milestone scan_b:
    means scan(lat=43.531, lon=5.452)
    emits msv_chain_v1_b

  milestone land:
    enable witnessed(msv_chain_v1_a) && witnessed(msv_chain_v1_b)
    means land(lat=43.529, lon=5.449)
    emits msv_chain_v1_landed

  milestone report:
    enable witnessed(msv_chain_v1_landed)
    emits msv_chain_v1_reported
}
```

There is no "then". Each milestone says what it wants to be true (`means`), what fact it leaves behind when it is (`emits`, called a **witness**), and optionally when it becomes possible (`enable`). `report` has no `means` at all: it is a pure gate that writes a fact once its guard holds.

Compiled, it is four ordinary goals (3,166 bytes). The order is not stored anywhere. It falls out of the facts: `scan_a` and `scan_b` are claimable at once, possibly by different aircraft; the moment both witnesses exist, the guard of `land` becomes true on every aircraft that has seen them, and the auction finds a taker. Nobody told anyone to start `land`. It became possible.

That is also how the mission ends. It is finished when every witness exists, which is a property of the shared world that any aircraft can check, not a property of anyone's memory.

## What the fleet does with it

Each aircraft holds a replica of the goal pool, the claims and the witnesses. Allocation is a pure function of what aircraft have claimed: each aircraft writes only its own claim and its own price, and the winner of a goal is the highest live price. A silent aircraft's claims simply stop counting, which *is* the takeover. There is no election and no timeout protocol. (The mesh underneath it has no handshakes or sessions either; [we wrote about that separately](/notes/the-swarm-that-never-syncs).)

Once an aircraft holds a goal, a bounded planner works out *how*: for a scan goal from the ground, `takeoff`, `scan`, then a generic `mark_done` that writes the witness. The actions live in a flash library on the aircraft. Loom produces only goals, and the planner picks the actions.

You load a three-step survey. Four aircraft take the cells. One loses its radio: after a few seconds the others stop counting its claims, and the cell it held goes to whoever bids highest. An aircraft powered on late hears the world, catches up and starts taking work. The operator's laptop is closed for ten minutes and nothing stops. At no point did you write a line about failure.

## Phases, families, work that shows up later

Writing every guard by hand gets tedious, so the language has sugar that lowers to the same goals.

A `phase` is a group of milestones with an automatic gate; `phase BACK after OUT` adds the gate's witness to every guard in `BACK`. A `region cells = grid(AO, 2, 3)` with a `for c in cells:` loop expands to one scan goal per cell at compile time. And a `workset` is a live query for things that do not exist yet, such as detections:

```
workset people = query(target_*) where item.conf >= 0.7 && item.class == "person"

milestone shadow:
  over people
  means cover(dwell=30, alt=alt)
  done_when all_current or empty 60s
```

One goal serves all the contacts as they appear, and it closes when nothing new has shown up for sixty real seconds. None of it needs a ground link.

<figure class="diagram-block">
  <img src="/assets/notes/loom/dag-phases.png" alt="Phases compile to gates" loading="lazy" style="width:80%;height:auto;border-radius:6px;border:1px solid var(--border)" />
  <figcaption>Two phases compile to five goals. The gates are ordinary goals, and nothing in the fleet knows what a phase is.</figcaption>
</figure>

## The compiler's job is to refuse

This is the part we care about most. A mission that compiles and silently never finishes is the worst failure a mission language can have, because you find out on the flight line. So `loomc` reads the graph of which goal waits for which witness and refuses what it can *prove* is dead.

A one-letter typo:

```
error: the mission can never finish:
  - land waits for msv_typo_v1_aa, which nothing writes (a typo, or a step that was removed)
```

Guards that wait for each other in a circle:

```
error: the mission can never finish:
  - deadlock: a -> b -> a (each waits for the next one's witness, so none can ever be claimed)
```

A count that can never be reached (a gate waiting for five covered cells when the grid has four):

```
error: the mission can never finish:
  - gate waits for count(msv_t_v1_m_) >= 5, but only 4 witness(es) start with that prefix: it can never be reached
```

The same philosophy applies to the policies you can state. The set of `must` conditions is closed. `must insde(AO)` does not quietly become a rule that enforces nothing; it is an error that lists what is known. The bar for a refusal is **proof**. A guard that waits for something outside the mission, such as an operator's approval, is at most a warning, and a count over a work class has no static ceiling, so it is never refused. The compiler proves a mission dead. It cannot prove one alive.

## Saying what is enforced, and what is not

A rule is not a goal, so Loom keeps them apart and grades each one.

`must inside(AO)` is a **veto**: it compiles to a geofence held by the aircraft's native safety layer, below the goal pool, so a command that would leave the area is refused whatever the auction decided. (The fence is the circumscribed circle of your rectangle, a little larger than the area you drew, and the manifest says so.) `must separation(60)` is only a **monitor**: it is written down for the dashboard, and nothing aboard stops anyone breaking it. The grade is in the manifest, and it is the truth.

The test for what may be a core construct is one question: *does it mean the same thing with no ground link?* A milestone does. A fence does. A rule such as "when a new contact appears, spawn a tracking task" does not, so it is marked `-> conductor`, carried out by the ground, and allowed to be lost.

## A whole mission

Put it together and the flood-response plan from the book's capstone is about forty lines: a surveyed valley divided into cells, a relay held mid-valley that helps without gating completion, every person shadowed as they are found, an alert for the operator, a fence, and a final report that waits for two phases. It compiles to thirteen goals and 11.6 kB.

<figure class="diagram-block">
  <img src="/assets/notes/loom/dag-flood.png" alt="The flood mission as the fleet sees it" loading="lazy" style="width:70%;height:auto;border-radius:6px;border:1px solid var(--border)" />
  <figcaption>The flood mission as the fleet sees it. Not a program: a handful of goals and the witnesses they wait for. Generated from the compiled manifest.</figcaption>
</figure>

The operator authors it in the Mission Studio, part of the ground station, where a dry run executes the plan's own compiled guards against a simulated world and says which steps never finish and which aircraft are never used.

<figure class="diagram-block">
  <img src="/assets/notes/loom/studio-dryrun-done.png" alt="Mission Studio dry run" loading="lazy" style="width:100%;height:auto;border-radius:6px;border:1px solid var(--border)" />
  <figcaption>The Mission Studio's dry run, after a simulated mission completes.</figcaption>
</figure>

## What it does not do

The book is checked against the real compiler, so we should be as honest about the system as about the language.

- **The compiler can prove a program is dead, never that it will succeed.** A mission can compile and still not do what you meant. Finding out why takes the fleet's own account of each decision.
- **A `must` is only as strong as its grade.** The fence is a veto; separation and battery reserve in a mission are monitors. The native safety watchdog is a real failsafe, not a certified one.
- **Under a partition every side acts on a stale picture, by construction.** The design makes that cheap to recover from, not impossible.
- **Radio capacity is a hard limit.** With a live map and a live auction on a 250 kbps radio, the comfortable fleet size we measured is a handful of aircraft. Larger fleets need a faster radio, not a smarter protocol.
- **Collision avoidance is altitude bands plus a closest-approach guard**, not a certified detect-and-avoid system.
- **The hardware target has not flown yet.** The firmware runs in simulation and on PX4 in simulation. The first real boards are about to arrive.

None of this makes the idea less useful. It tells you which questions to ask of a mission before you trust it with an aircraft.

The Loom book is 124 pages and every program in it is compiled by the real compiler when it is built. If you would like to try Loom on your own fleet, get in touch.
