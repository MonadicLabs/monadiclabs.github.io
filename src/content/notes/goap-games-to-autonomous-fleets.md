---
title: "GOAP: from F.E.A.R.'s soldiers to autonomous UAV/UGV fleets"
description: "Goal-Oriented Action Planning started as a trick to make FPS enemies stop feeling scripted. Twenty years later, the same idea is showing up as the right architecture for swarms that have to keep working when the link doesn't."
date: 2026-08-22
tags: ["GOAP", "Autonomy", "UAV/UGV", "Robotics", "Game AI"]
placeholder: false
---

Goal-Oriented Action Planning (GOAP) is a small idea that keeps resurfacing in
places it wasn't originally built for. It started as a fix for a specific
problem in first-person-shooter enemy AI in the mid-2000s. It's ending up,
twenty years later, as a reasonable architecture for how a fleet of autonomous
aircraft or ground vehicles should decide what to do next when nobody is
holding the joystick — and, more specifically, when nobody *can*.

## Where it came from: STRIPS, and a game that got tired of scripting

GOAP isn't a game-industry invention dressed up for robotics. It's the reverse
— it's a robotics-and-planning idea from 1971 that the games industry
borrowed, real-timed, and made famous. STRIPS (the Stanford Research Institute
Problem Solver), described by Richard Fikes and Nils Nilsson in their 1971
paper, introduced the representation that almost every classical automated
planner since has used in some form: a world state made of predicates, a set
of operators with **preconditions** (what must be true to use them) and
**effects** (how they change the world), and a search over sequences of
operators that gets you from the current state to a goal state.[^1]

Thirty-odd years later, Jeff Orkin — AI lead at Monolith Productions, having
already worked on *No One Lives Forever 2* — adapted that same
precondition/effect representation for real-time use in *F.E.A.R.* (2005).[^2]
The problem he was solving was concrete: hand-scripted enemy behavior gets
brittle fast. A hardcoded "if door is blocked, do X" branch handles the case
the designer thought of and nothing else. Orkin's fix, detailed in his GDC
2006 talk *"Three States and a Plan: The A.I. of F.E.A.R.,"* was to strip the
finite state machine down to almost nothing — just three states (`GoTo`,
`Animate`, `Use Smart Object`) — and let an A* planner pick which sequence of
actions actually satisfies a soldier's current goal, replanning whenever the
world changes.[^3][^4]

The result became the canonical GOAP demo, and it's a genuinely good
illustration of what goal-directed planning buys you over a script: in
*F.E.A.R.*, if a player slammed a door on a soldier mid-fight, the soldier
didn't just get stuck — the planner re-evaluated the world state (door now
blocked), found that the `ShootThroughDoor` or `FlankToWindow` actions were
still valid paths to the same goal (`AttackTarget`), and picked one. Nobody
wrote a rule for "player closes door." Nobody had to.[^3]

<figure class="diagram-block">
  <div class="terminal-window">
    <div class="terminal-bar">
      <span class="dots"><span class="dot r"></span><span class="dot y"></span><span class="dot g"></span></span>
      ~/fear/door-example.svg
    </div>
    <div style="padding:1.25rem">
      <svg viewBox="0 0 820 240" style="width:100%;height:auto" role="img" aria-label="A world-state box feeds a planner, which searches two candidate action sequences toward the same goal — ShootThroughDoor is invalidated once the door is blocked, FlankToWindow is chosen instead" font-family="var(--font-mono)">
        <defs><marker id="doorArrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6.5" markerHeight="6.5" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="#1158ff"/></marker></defs>
        <rect x="16" y="70" width="170" height="90" rx="3" fill="none" stroke="var(--border)" stroke-width="1.25" stroke-dasharray="4 3"/>
        <text x="101" y="98" fill="var(--fg)" font-size="11" text-anchor="middle" letter-spacing="0.5">WORLD STATE</text>
        <text x="101" y="118" fill="var(--muted)" font-size="8" text-anchor="middle">doorBlocked = true</text>
        <text x="101" y="132" fill="var(--muted)" font-size="8" text-anchor="middle">targetVisible = true</text>
        <line x1="188" y1="115" x2="228" y2="115" stroke="#1158ff" stroke-width="1.75" marker-end="url(#doorArrow)"/>
        <rect x="232" y="55" width="180" height="120" rx="3" fill="var(--surface-2)" stroke="#1158ff" stroke-width="2"/>
        <text x="322" y="82" fill="#1158ff" font-size="11" font-weight="600" text-anchor="middle" letter-spacing="1">PLANNER</text>
        <text x="322" y="103" fill="var(--fg)" font-size="8.5" text-anchor="middle">A* over actions</text>
        <text x="322" y="117" fill="var(--fg)" font-size="8.5" text-anchor="middle">goal: AttackTarget</text>
        <text x="322" y="140" fill="var(--muted)" font-size="7.5" text-anchor="middle">picks first plan whose</text>
        <text x="322" y="152" fill="var(--muted)" font-size="7.5" text-anchor="middle">preconditions still hold</text>
        <line x1="414" y1="90" x2="456" y2="72" stroke="var(--muted)" stroke-width="1.5"/>
        <line x1="414" y1="140" x2="456" y2="158" stroke="#1158ff" stroke-width="1.75" marker-end="url(#doorArrow)"/>
        <rect x="460" y="45" width="170" height="55" rx="3" fill="none" stroke="var(--border)" stroke-width="1.25" stroke-dasharray="4 3"/>
        <text x="545" y="66" fill="var(--muted)" font-size="9.5" text-anchor="middle">ShootThroughDoor</text>
        <text x="545" y="82" fill="var(--muted)" font-size="7.5" text-anchor="middle">✕ precondition fails</text>
        <rect x="460" y="130" width="170" height="55" rx="3" fill="var(--surface-2)" stroke="#1158ff" stroke-width="1.75"/>
        <text x="545" y="151" fill="#1158ff" font-size="9.5" font-weight="600" text-anchor="middle">FlankToWindow</text>
        <text x="545" y="167" fill="var(--fg)" font-size="7.5" text-anchor="middle">✓ preconditions hold</text>
        <line x1="632" y1="157" x2="670" y2="157" stroke="#1158ff" stroke-width="1.75" marker-end="url(#doorArrow)"/>
        <rect x="674" y="130" width="130" height="55" rx="3" fill="none" stroke="#1158ff" stroke-width="2"/>
        <text x="739" y="151" fill="#1158ff" font-size="9.5" font-weight="600" text-anchor="middle">AttackTarget</text>
        <text x="739" y="167" fill="var(--fg)" font-size="7.5" text-anchor="middle">goal reached</text>
        <text x="410" y="220" fill="var(--muted)" font-size="8.5" text-anchor="middle">SAME GOAL, BOTH TIMES — CLOSING THE DOOR INVALIDATES ONE PLAN, NOT THE GOAL</text>
      </svg>
    </div>
  </div>
  <figcaption>The actual F.E.A.R. example: the goal never changes, only which plan satisfies it.</figcaption>
</figure>

## It spread, then it mostly got replaced

GOAP showed up across a run of mid-to-late 2000s and early-2010s titles:
*F.E.A.R.* and *F.E.A.R. 2*, *Condemned: Criminal Origins* and *Condemned 2*,
*S.T.A.L.K.E.R.: Shadow of Chernobyl*, *Just Cause 2*, *Deus Ex: Human
Revolution*, the 2013 *Tomb Raider* reboot, and Monolith's own *Middle-earth:
Shadow of Mordor* and *Shadow of War*, with modified variants in *Transformers:
War for Cybertron*.[^5][^6] By 2015, it was established enough that GDC hosted
a ten-years-later retrospective on it.[^7]

It also ran into a real ceiling. A flat goal-and-action search scales
uncomfortably once the action set and state space grow — planning gets
expensive, and debugging *why* a planner chose a weird action sequence is
harder than reading a hand-authored tree.[^8] A lot of studios moved to
Hierarchical Task Network (HTN) planning instead, which trades some of GOAP's
open-endedness for designer-authored structure: Guerrilla Games used HTN
starting with *Killzone 2* and through *Horizon Zero Dawn*, and it shows up in
*Max Payne 3* and *Dying Light* as well.[^8][^9] The honest summary: GOAP won
on adaptability, HTN won on controllability, and most AAA studios doing
character AI at scale eventually wanted more of the latter.

## Why the same idea is showing up again in robotics

Here's the thing that's easy to miss if you only know GOAP as a game-AI
anecdote: it never stopped being STRIPS. The precondition/effect,
search-to-a-goal representation Orkin real-timed for *F.E.A.R.* is the same
representation the automated-planning research community (the ICAPS
community, PDDL, all of it) has kept using for actual robots the whole time.
GOAP wasn't a detour from that lineage — it's a real-time-tuned dialect of it.

That's not a coincidence worth glossing over, because it means the same
architectural bet — *don't hand-script the response to every situation; give
the agent a goal and a set of actions with honest preconditions and effects,
and let it replan when the world changes* — pays off for exactly the same
reason in robotics that it did in *F.E.A.R.*: the real world, like a game
level, produces situations nobody scripted for.

This isn't hypothetical. ROSPlan, published at ICAPS 2015 by Cashmore, Fox,
Long, Magazzeni, and colleagues, embeds a PDDL-style task planner directly
into the Robot Operating System, and its case study is an autonomous
underwater vehicle replanning its mission as conditions change mid-dive —
functionally the same problem *F.E.A.R.*'s soldiers were solving, run on
hardware that doesn't get a respawn.[^10]

## Where it gets sharper: fleets, and links you can't count on

A single robot replanning on its own is one problem. A *fleet* — a dozen
UAVs, or a mixed UAV/UGV team — adds a second one: who does what, and who
decides.

The default academic answer to "who does what" is market-based task
allocation: agents bid on tasks, a mechanism assigns them, everyone's
better off than an uncoordinated free-for-all. Gerkey and Matarić's 2004
taxonomy of multi-robot task allocation is still the reference point for that
whole line of work.[^11] It's a good answer — if you can hold an auction. An
auction needs a channel: something to broadcast bids on and something to
collect them, reliably, before anyone acts.

That assumption is exactly the one that doesn't survive contact with a
defense UAV/UGV swarm scenario. DARPA's OFFSET program is the clearest public
statement of where military swarm research has been heading: swarms of 250+
air and ground robots in contested urban environments, where — in DARPA's own
framing — *"the swarm commander defines the mission plan, while vehicles
self-allocate and autonomously execute that plan."*[^12][^13] Self-allocate,
under jamming, GPS denial, and a link to the operator that is explicitly
expected to degrade or drop, is a materially different problem than
self-allocate over a live tactical network with an auction running on top of
it.

<figure class="diagram-block">
  <img src="/assets/notes/darpa-offset-swarm.webp" alt="Two small unmanned aircraft flying over a mock urban training facility during a DARPA OFFSET swarm field experiment" loading="lazy" style="width:100%;height:auto;border-radius:6px;border:1px solid var(--border)" />
  <figcaption>Unmanned aircraft during a DARPA OFFSET field experiment, testing swarm tactics for small-unit forces in urban environments. Credit: <a href="https://www.darpa.mil/news/2021/offset-swarms-take-flight">DARPA</a>, public domain (U.S. government work).</figcaption>
</figure>

That's the actual argument for goal-directed planning at the fleet level, not
just the single-robot level: if every unit is carrying the same goal/action
model and replanning locally from whatever state it can observe or has been
gossiped by nearby peers, then losing the link to the operator — or to half
the fleet — degrades *information*, not *capability*. Nothing about how a
unit decides what to do next was depending on that link being up in the first
place. A live auction, or a live command stream, can't say the same.

## A worked example

Take a three-aircraft search-and-report mission over a grid of cells, loosely
in the shape of the *F.E.A.R.* door example — goals and actions as data, not
a flowchart:

| Goal | Satisfied when | Utility |
| --- | --- | --- |
| `AreaSearched` | every assigned cell has `searched = true` | low — the default, do this absent anything more urgent |
| `TargetReported` | `hasTarget = true` and `reportSent = true` | high — jumps to top priority the moment a target exists |
| `Recover` | `fuelLow = true` and `atBase = true` | highest — overrides everything else |

| Action | Precondition | Effect |
| --- | --- | --- |
| `SweepCell` | `atAssignedCell`, `cell.searched = false` | `cell.searched = true` (may reveal `hasTarget = true`) |
| `MoveTo(cell)` | — | `atCell = cell` |
| `ClaimTarget` | `hasTarget = true`, no peer holds `claimed` for this target | `claimed = self` (published to shared state) |
| `RelayReport` | `hasTarget = true`, `claimed = self` | `reportSent = true` (routes via any peer if own uplink is down) |
| `ReturnToBase` | `fuelLow = true` | `atCell = base` |

<figure class="diagram-block">
  <div class="terminal-window">
    <div class="terminal-bar">
      <span class="dots"><span class="dot r"></span><span class="dot y"></span><span class="dot g"></span></span>
      ~/swarm/link-cut.svg
    </div>
    <div style="padding:1.25rem">
      <svg viewBox="0 0 820 300" style="width:100%;height:auto" role="img" aria-label="Top row: ground control linked to three aircraft, each sweeping an assigned cell. Bottom row: aircraft A's uplink to ground control is jammed, so it relays its report through aircraft B over the mesh instead" font-family="var(--font-mono)">
        <text x="410" y="20" fill="var(--muted)" font-size="9" text-anchor="middle" letter-spacing="0.5">ALL UPLINKS UP</text>
        <rect x="20" y="34" width="110" height="70" rx="3" fill="var(--surface-2)" stroke="#1158ff" stroke-width="1.1"/>
        <text x="75" y="64" fill="var(--fg)" font-size="10" text-anchor="middle" letter-spacing="0.5">GC</text>
        <text x="75" y="80" fill="var(--muted)" font-size="7.5" text-anchor="middle">operator</text>
        <line x1="132" y1="55" x2="170" y2="55" stroke="#1158ff" stroke-width="1.5"/>
        <line x1="132" y1="69" x2="330" y2="69" stroke="#1158ff" stroke-width="1.5"/>
        <line x1="132" y1="83" x2="490" y2="83" stroke="#1158ff" stroke-width="1.5"/>
        <rect x="170" y="34" width="100" height="70" rx="3" fill="var(--surface-2)" stroke="#1158ff" stroke-width="1.1"/>
        <text x="220" y="61" fill="var(--fg)" font-size="9.5" text-anchor="middle" letter-spacing="0.5">A</text>
        <text x="220" y="76" fill="var(--muted)" font-size="7" text-anchor="middle">sweeping cell 1</text>
        <rect x="330" y="34" width="100" height="70" rx="3" fill="var(--surface-2)" stroke="#1158ff" stroke-width="1.1"/>
        <text x="380" y="61" fill="var(--fg)" font-size="9.5" text-anchor="middle" letter-spacing="0.5">B</text>
        <text x="380" y="76" fill="var(--muted)" font-size="7" text-anchor="middle">sweeping cell 2</text>
        <rect x="490" y="34" width="100" height="70" rx="3" fill="var(--surface-2)" stroke="#1158ff" stroke-width="1.1"/>
        <text x="540" y="61" fill="var(--fg)" font-size="9.5" text-anchor="middle" letter-spacing="0.5">C</text>
        <text x="540" y="76" fill="var(--muted)" font-size="7" text-anchor="middle">sweeping cell 3</text>
        <line x1="20" y1="150" x2="800" y2="150" stroke="var(--border)" stroke-width="1" stroke-dasharray="2 4"/>
        <text x="410" y="182" fill="var(--muted)" font-size="9" text-anchor="middle" letter-spacing="0.5">A's UPLINK JAMMED — MESH TO B AND C STILL UP</text>
        <rect x="20" y="196" width="110" height="70" rx="3" fill="none" stroke="var(--border)" stroke-width="1.25" stroke-dasharray="4 3"/>
        <text x="75" y="226" fill="var(--muted)" font-size="10" text-anchor="middle" letter-spacing="0.5">GC</text>
        <text x="75" y="242" fill="var(--muted)" font-size="7" text-anchor="middle">gets report via B</text>
        <rect x="170" y="196" width="100" height="70" rx="3" fill="none" stroke="var(--muted)" stroke-width="1.25" stroke-dasharray="3 3"/>
        <text x="220" y="223" fill="var(--fg)" font-size="9.5" text-anchor="middle" letter-spacing="0.5">A</text>
        <text x="220" y="238" fill="var(--muted)" font-size="7" text-anchor="middle">found target</text>
        <text x="220" y="250" fill="var(--muted)" font-size="7" text-anchor="middle">uplink ✕</text>
        <rect x="330" y="196" width="100" height="70" rx="3" fill="var(--surface-2)" stroke="#1158ff" stroke-width="1.75"/>
        <text x="380" y="223" fill="#1158ff" font-size="9.5" font-weight="600" text-anchor="middle" letter-spacing="0.5">B</text>
        <text x="380" y="238" fill="var(--fg)" font-size="7" text-anchor="middle">relaying for A</text>
        <rect x="490" y="196" width="100" height="70" rx="3" fill="var(--surface-2)" stroke="#1158ff" stroke-width="1.1"/>
        <text x="540" y="223" fill="var(--fg)" font-size="9.5" text-anchor="middle" letter-spacing="0.5">C</text>
        <text x="540" y="238" fill="var(--muted)" font-size="7" text-anchor="middle">sweeping cell 3</text>
        <line x1="132" y1="231" x2="168" y2="231" stroke="var(--muted)" stroke-width="1.5" stroke-dasharray="2 3"/>
        <text x="150" y="222" fill="var(--muted)" font-size="7" text-anchor="middle">✕</text>
        <line x1="272" y1="231" x2="328" y2="231" stroke="#1158ff" stroke-width="1.75"/>
        <text x="300" y="222" fill="var(--muted)" font-size="6.5" text-anchor="middle">mesh</text>
        <line x1="332" y1="255" x2="132" y2="255" stroke="#1158ff" stroke-width="1.75"/>
        <text x="232" y="270" fill="var(--muted)" font-size="6.5" text-anchor="middle">RelayReport: reportSent = true</text>
        <text x="410" y="292" fill="var(--fg)" font-size="9" text-anchor="middle">Same plan, no fallback mode — RelayReport's precondition was never "uplink up," just "hasTarget."</text>
      </svg>
    </div>
  </div>
  <figcaption>The worked example, visualized: A's direct link to ground control is down, so RelayReport routes through B over the mesh instead — the plan doesn't change, only which peer carries it.</figcaption>
</figure>

Under normal conditions, this is unremarkable: each aircraft sweeps its
assigned cells, and if one finds something, `TargetReported`'s utility spikes,
it claims the target so a second aircraft doesn't duplicate the work, and it
reports.

The interesting case is the one that actually matters for a defense scenario:
the operator link drops mid-mission, or one aircraft's own uplink is jammed
while its mesh link to the other two still works. Nothing above changes. The
aircraft with the dead uplink still finds `RelayReport`'s precondition
satisfiable — through a peer — because the precondition was written in terms
of *the world state*, not *a specific link being up*. No fallback mode fires,
because there was never a primary path that this was a fallback *for*. The
plan for "what do I do if my link drops" was never a special case; it falls
out of the same goal search every other tick does.

## Where we land on this

This isn't an academic exercise for us. It's the mission-logic layer we
actually ship: [fleece](/products/fleece), our decentralized coordination
runtime, is a GOAP-class planner running identically on every node — goals and
actions authored as data, gossip-synchronized shared state instead of a
central coordinator, claim-based allocation instead of an auction. It's the
software underneath [the SPU](/products/spu), our companion-computer hardware,
and the reason cutting the link to the operator doesn't stop a swarm from
finishing the mission it was already flying.

The line from a *F.E.A.R.* soldier deciding to shoot through a window instead
of a blocked door, to a UAV swarm deciding to keep searching a grid after
losing its uplink, is a straight one. Same representation, same reason it
works: write down what "done" looks like and what your actions actually do,
and let the planner handle the part nobody scripted for.

---

### Sources

[^1]: Fikes, R. E., & Nilsson, N. J. (1971). ["STRIPS: A New Approach to the Application of Theorem Proving to Problem Solving."](https://www.ijcai.org/Proceedings/71/Papers/055.pdf) *Proceedings of IJCAI 1971.* See also: [Stanford Research Institute Problem Solver — Wikipedia](https://en.wikipedia.org/wiki/Stanford_Research_Institute_Problem_Solver).
[^2]: Orkin, J. — biography and project history via [Building the AI of F.E.A.R. with Goal Oriented Action Planning, Game Developer](https://www.gamedeveloper.com/design/building-the-ai-of-f-e-a-r-with-goal-oriented-action-planning).
[^3]: Orkin, J. (2006). ["Three States and a Plan: The A.I. of F.E.A.R."](https://www.gamedevs.org/uploads/three-states-plan-ai-of-fear.pdf) *Game Developers Conference 2006.*
[^4]: ["GDC 2006: Jeff Orkin - Three States and a Plan: The AI of F.E.A.R." — Internet Archive recording](https://archive.org/details/GDC2006Orkin).
[^5]: Orkin, J. ["Applying Goal-Oriented Action Planning to Games."](https://scispace.com/pdf/applying-goal-oriented-action-planning-to-games-34ea1slk48.pdf) *AI Game Programming Wisdom 2.*
[^6]: [Building the AI of F.E.A.R. with Goal Oriented Action Planning — Game Developer](https://www.gamedeveloper.com/design/building-the-ai-of-f-e-a-r-with-goal-oriented-action-planning) (list of GOAP-adopting titles).
[^7]: Higley, P., & Conway, C. (2015). ["Goal-Oriented Action Planning: Ten Years Old and No Fear!"](https://media.gdcvault.com/gdc2015/presentations/Higley_Peter_Goal-Oriented_Action_Planning.pdf) *Game Developers Conference 2015.*
[^8]: [FSM, BT, HTN, GOAP, other — GameDev.net discussion](https://gamedev.net/forums/topic/700989-fsm-bt-htn-goap-other/); [Choosing between Behavior Tree and GOAP — Davide Aversa](https://www.davideaversa.it/blog/choosing-behavior-tree-goap-planning/).
[^9]: Guerrilla Games. ["The AI of Horizon Zero Dawn."](https://www.guerrilla-games.com/read/the-ai-of-horizon-zero-dawn) and [Behind The AI of Horizon Zero Dawn, Part 1 — Game Developer](https://www.gamedeveloper.com/design/behind-the-ai-of-horizon-zero-dawn-part-1-) (HTN planning, used since *Killzone 2*).
[^10]: Cashmore, M., Fox, M., Long, D., Magazzeni, D., Carrera, A., Palomeras, N., Hurtós, N., & Carreras, M. (2015). ["ROSPlan: Planning in the Robot Operating System."](https://ojs.aaai.org/index.php/ICAPS/article/view/13699) *Proceedings of ICAPS 2015.*
[^11]: Gerkey, B. P., & Matarić, M. J. (2004). "A Formal Analysis and Taxonomy of Task Allocation in Multi-Robot Systems." *The International Journal of Robotics Research, 23*(9), 939–954. [ResearchGate record](https://www.researchgate.net/publication/220122267_A_Formal_Analysis_and_Taxonomy_of_Task_Allocation_in_Multi-Robot_Systems).
[^12]: DARPA. (2016). ["OFFSET Envisions Swarm Capabilities for Small Urban Ground Units."](https://www.darpa.mil/news/2016/offset-swarm-capabilities)
[^13]: DSIAC. ["DARPA OFFSET: Autonomous Drone Swarms for Warfighters."](https://dsiac.dtic.mil/articles/darpa-offset-autonomous-drone-swarms-for-warfighters/)
