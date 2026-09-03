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

<figure class="diagram-block">
  <img src="/assets/notes/darpa-offset-fortbenning.webp" alt="A line of four small quadcopters flying in formation over a mock urban training village during a DARPA OFFSET field experiment, with ground robots visible on the pavement below" loading="lazy" style="width:100%;height:auto;border-radius:6px;border:1px solid var(--border)" />
  <figcaption>Autonomous air and ground vehicles during DARPA's OFFSET program, second field experiment, Fort Benning, Georgia. Credit: <a href="https://www.darpa.mil/news-events/2019-08-07">DARPA</a>, public domain (U.S. government work).</figcaption>
</figure>

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

<figure class="diagram-block">
  <img src="/assets/notes/Shakey-the-robot-implemented-the-STRIPS-planning-algorithm-Fikes-and-Nilsson-1971.webp" alt="Shakey the robot implemented the STRIPS planning algorithm (Fikes and Nilsson 1971), an SRI mobile robot from 1971" loading="lazy" style="width:100%;height:auto;border-radius:6px;border:1px solid var(--border)" />
  <figcaption>Shakey, the mobile robot that implemented the STRIPS planning algorithm. Image via the Fikes and Nilsson 1971 paper. Creative Commons / Wikimedia Commons.</figcaption>
</figure>

Thirty-odd years later, Jeff Orkin — AI lead at Monolith Productions, having
already worked on *No One Lives Forever 2* — adapted that same
precondition/effect representation for real-time use in *F.E.A.R.* (2005).[^2][^5]

<figure class="diagram-block">
  <img src="/assets/notes/jeff-orkin.webp" alt="Jeff Orkin, AI lead at Monolith Productions, with the GOAP architecture he pioneered for F.E.A.R." loading="lazy" style="width:100%;height:auto;border-radius:6px;border:1px solid var(--border)" />
  <figcaption>Jeff Orkin (2006) — Monolith’s AI lead who adapted GOAP for *F.E.A.R.* and coined the term. Image via National Accelerator Group, Namibia, 2025.</figcaption>
</figure>

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
      <svg viewBox="0 0 824 236" style="width:100%;height:auto" role="img" aria-label="A world-state box feeds a planner, which searches two candidate action sequences toward the same goal — ShootThroughDoor is invalidated once the door is blocked, FlankToWindow is chosen instead" font-family="var(--font-mono)">
        <defs><marker id="doorArrow" viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,1 L9,5 L0,9 z" fill="#1158ff"/></marker></defs>
        <rect x="16" y="66" width="176" height="98" rx="6" fill="none" stroke="var(--border)" stroke-width="1.25" stroke-dasharray="5 3"/>
        <text x="104" y="98" fill="var(--fg)" font-size="12" text-anchor="middle" letter-spacing="0.8">WORLD STATE</text>
        <text x="104" y="122" fill="var(--muted)" font-size="10" text-anchor="middle">doorBlocked = true</text>
        <text x="104" y="138" fill="var(--muted)" font-size="10" text-anchor="middle">targetVisible = true</text>
        <line x1="192" y1="115" x2="222" y2="115" stroke="#1158ff" stroke-width="1.75" marker-end="url(#doorArrow)"/>
        <rect x="224" y="52" width="184" height="126" rx="6" fill="var(--surface-2)" stroke="#1158ff" stroke-width="2"/>
        <text x="316" y="82" fill="#1158ff" font-size="13" font-weight="600" text-anchor="middle" letter-spacing="1">PLANNER</text>
        <text x="316" y="106" fill="var(--fg)" font-size="10" text-anchor="middle">A* over actions</text>
        <text x="316" y="122" fill="var(--fg)" font-size="10" text-anchor="middle">goal: AttackTarget</text>
        <text x="316" y="146" fill="var(--muted)" font-size="8.5" text-anchor="middle">picks the first plan whose</text>
        <text x="316" y="159" fill="var(--muted)" font-size="8.5" text-anchor="middle">preconditions still hold</text>
        <line x1="408" y1="92" x2="452" y2="74" stroke="var(--muted)" stroke-width="1.5"/>
        <line x1="408" y1="142" x2="452" y2="160" stroke="#1158ff" stroke-width="1.75" marker-end="url(#doorArrow)"/>
        <rect x="456" y="46" width="176" height="58" rx="6" fill="none" stroke="var(--border)" stroke-width="1.25" stroke-dasharray="5 3"/>
        <text x="544" y="70" fill="var(--muted)" font-size="10.5" text-anchor="middle">ShootThroughDoor</text>
        <text x="544" y="88" fill="var(--muted)" font-size="8.5" text-anchor="middle">✕ precondition fails</text>
        <rect x="456" y="130" width="176" height="58" rx="6" fill="var(--surface-2)" stroke="#1158ff" stroke-width="2"/>
        <text x="544" y="154" fill="#1158ff" font-size="10.5" font-weight="600" text-anchor="middle">FlankToWindow</text>
        <text x="544" y="172" fill="var(--fg)" font-size="8.5" text-anchor="middle">✓ preconditions hold</text>
        <line x1="632" y1="159" x2="676" y2="159" stroke="#1158ff" stroke-width="1.75" marker-end="url(#doorArrow)"/>
        <rect x="680" y="130" width="128" height="58" rx="6" fill="none" stroke="#1158ff" stroke-width="2"/>
        <text x="744" y="154" fill="#1158ff" font-size="10.5" font-weight="600" text-anchor="middle">AttackTarget</text>
        <text x="744" y="172" fill="var(--fg)" font-size="8.5" text-anchor="middle">goal reached</text>
        <text x="412" y="222" fill="var(--muted)" font-size="9" text-anchor="middle" letter-spacing="1">SAME GOAL, BOTH TIMES · CLOSING THE DOOR INVALIDATES ONE PLAN, NOT THE GOAL</text>
      </svg>
    </div>
  </div>
  <figcaption>The actual F.E.A.R. example: the goal never changes, only which plan satisfies it.</figcaption>
</figure>

## It spread, then it mostly got replaced

GOAP started at Monolith and mostly stayed there at first — it powered
*F.E.A.R. 2* and both *Condemned* games on the same engine and the same bet.

<figure class="diagram-block">
  <img src="/assets/notes/fear-2005.webp" alt="Two Replica soldiers advancing through a burning industrial corridor in F.E.A.R., weapons raised" loading="lazy" style="width:100%;height:auto;border-radius:6px;border:1px solid var(--border)" />
  <figcaption>The canonical GOAP showcase: Monolith's Replica soldiers in <em>F.E.A.R.</em> (2005), the enemies that made planners famous. Screenshot via Steam. © Monolith Productions.</figcaption>
</figure>

Then it left the building. GSC Game World built *S.T.A.L.K.E.R.: Shadow of
Chernobyl* (2007) around an A-Life simulation that gave every stalker in the
Zone its own goals and its own plan for reaching them, running whether the
player was watching or a hundred meters away.[^6]

<figure class="diagram-block">
  <img src="/assets/notes/stalker-chernobyl.webp" alt="A wrecked helicopter in front of the Chernobyl reactor sarcophagus in S.T.A.L.K.E.R.: Shadow of Chernobyl" loading="lazy" style="width:100%;height:auto;border-radius:6px;border:1px solid var(--border)" />
  <figcaption>The Zone in <em>S.T.A.L.K.E.R.: Shadow of Chernobyl</em> (2007). Screenshot via Steam. © GSC Game World.</figcaption>
</figure>

Avalanche put it underneath the chaos of *Just Cause 2* (2010), and Eidos-Montréal used it for guards in *Deus Ex: Human Revolution*
(2011) — the ones that search, flank, and call each other over rather than
walking a fixed patrol loop.[^6]

<figure class="diagram-block">
  <img src="/assets/notes/justcause2.webp" alt="Rico Rodriguez free-falling over tropical islands and a suspension bridge at sunset in Just Cause 2" loading="lazy" style="width:100%;height:auto;border-radius:6px;border:1px solid var(--border)" />
  <figcaption><em>Just Cause 2</em> (2010), Panau at dusk. Screenshot via Steam. © Avalanche Studios / Square Enix.</figcaption>
</figure>

<figure class="diagram-block">
  <img src="/assets/notes/deusex-hr.webp" alt="Adam Jensen taking cover beside a small bipedal security robot inside an industrial facility in Deus Ex: Human Revolution" loading="lazy" style="width:100%;height:auto;border-radius:6px;border:1px solid var(--border)" />
  <figcaption>Jensen vs. a security bot in <em>Deus Ex: Human Revolution</em> (2011). Screenshot via Steam. © Eidos-Montréal / Square Enix.</figcaption>
</figure>

By the time Crystal Dynamics shipped the 2013 *Tomb Raider* reboot, GOAP was
a known, bankable technique for a AAA action game rather than a novelty.[^6]

<figure class="diagram-block">
  <img src="/assets/notes/tombraider-2013.webp" alt="Lara Croft sprinting through a mountain village as a burning cargo plane crashes behind her in the 2013 Tomb Raider reboot" loading="lazy" style="width:100%;height:auto;border-radius:6px;border:1px solid var(--border)" />
  <figcaption>The 2013 <em>Tomb Raider</em> reboot. Screenshot via Steam. © Crystal Dynamics / Square Enix.</figcaption>
</figure>

Monolith itself made one more major run at it in *Middle-earth: Shadow of
Mordor* (2014) and *Shadow of War* (2017) — after which the studio's own
Nemesis system, not GOAP, became the thing everyone talked about.[^6]

<figure class="diagram-block">
  <img src="/assets/notes/shadow-of-mordor.webp" alt="Talion facing a leaping Uruk warrior amid orc crowds in a fortress courtyard in Middle-earth: Shadow of Mordor" loading="lazy" style="width:100%;height:auto;border-radius:6px;border:1px solid var(--border)" />
  <figcaption>An Uruk captain closing in <em>Middle-earth: Shadow of Mordor</em> (2014). Screenshot via Steam. © Monolith Productions / WB Games.</figcaption>
</figure>

<figure class="diagram-block">
  <img src="/assets/notes/shadow-of-war.webp" alt="A fiery fortress siege with orcs charging across snow toward burning ramparts in Middle-earth: Shadow of War" loading="lazy" style="width:100%;height:auto;border-radius:6px;border:1px solid var(--border)" />
  <figcaption>Fortress assault in <em>Middle-earth: Shadow of War</em> (2017). Screenshot via Steam. © Monolith Productions / WB Games.</figcaption>
</figure>

Modified variants of the same idea turned up as far afield as *Transformers:
War for Cybertron*, and by 2015 GOAP was established enough that GDC hosted a
ten-years-later retrospective on it.[^7]

It also ran into a real ceiling. A flat goal-and-action search scales
uncomfortably once the action set and state space grow — planning gets
expensive, and debugging *why* a planner chose a weird action sequence is
harder than reading a hand-authored tree.[^8] A lot of studios moved to
Hierarchical Task Network (HTN) planning instead, which trades some of GOAP's
open-endedness for designer-authored structure: Guerrilla Games used HTN
starting with *Killzone 2* and through *Horizon Zero Dawn*, and it shows up in
*Max Payne 3* and *Dying Light* as well.[^8][^9] Guerrilla's own GDC deck lays
out why: an HTN planner recursively refines an abstract task (their toy
example is `(eat fruit)`) through a *method* — a set of *branches*, each with
declarative preconditions — until a problem solver has bound every variable
and bottomed out at concrete, executable tasks.[^14] The honest summary: GOAP
won on adaptability, HTN won on controllability, and most AAA studios doing
character AI at scale eventually wanted more of the latter.

<figure class="diagram-block">
  <div class="terminal-window">
    <div class="terminal-bar">
      <span class="dots"><span class="dot r"></span><span class="dot y"></span><span class="dot g"></span></span>
      ~/horizon/htn-in-brief.svg
    </div>
    <div style="padding:1.25rem">
      <svg viewBox="0 0 828 226" style="width:100%;height:auto" role="img" aria-label="An abstract task (eat fruit) is refined by a method with three branches; a problem solver checks each branch's preconditions against world state and returns a solution (banana), which becomes a concrete task" font-family="var(--font-mono)">
        <defs><marker id="htnArrow" viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,1 L9,5 L0,9 z" fill="#1158ff"/></marker></defs>
        <rect x="16" y="70" width="120" height="64" rx="6" fill="var(--surface-2)" stroke="var(--border)" stroke-width="1.25"/>
        <text x="76" y="98" fill="var(--fg)" font-size="10.5" text-anchor="middle" letter-spacing="0.5">ABSTRACT TASK</text>
        <text x="76" y="116" fill="var(--muted)" font-size="10" text-anchor="middle">(eat fruit)</text>
        <line x1="136" y1="102" x2="166" y2="102" stroke="#1158ff" stroke-width="1.75" marker-end="url(#htnArrow)"/>
        <rect x="170" y="30" width="150" height="144" rx="6" fill="var(--surface-2)" stroke="#1158ff" stroke-width="2"/>
        <text x="245" y="50" fill="#1158ff" font-size="11.5" font-weight="600" text-anchor="middle" letter-spacing="0.8">METHOD</text>
        <rect x="184" y="60" width="122" height="30" rx="4" fill="none" stroke="var(--border)" stroke-width="1"/>
        <text x="245" y="79" fill="var(--muted)" font-size="9" text-anchor="middle">branch: in possession</text>
        <rect x="184" y="96" width="122" height="30" rx="4" fill="none" stroke="var(--border)" stroke-width="1"/>
        <text x="245" y="115" fill="var(--muted)" font-size="9" text-anchor="middle">branch: get from house</text>
        <rect x="184" y="132" width="122" height="30" rx="4" fill="none" stroke="var(--border)" stroke-width="1"/>
        <text x="245" y="151" fill="var(--muted)" font-size="9" text-anchor="middle">branch: buy in store</text>
        <line x1="320" y1="102" x2="350" y2="102" stroke="#1158ff" stroke-width="1.75" marker-end="url(#htnArrow)"/>
        <rect x="354" y="58" width="158" height="88" rx="6" fill="var(--surface-2)" stroke="#1158ff" stroke-width="2"/>
        <text x="433" y="82" fill="#1158ff" font-size="11.5" font-weight="600" text-anchor="middle" letter-spacing="0.8">PROBLEM SOLVER</text>
        <text x="433" y="102" fill="var(--fg)" font-size="9" text-anchor="middle">checks preconditions</text>
        <text x="433" y="116" fill="var(--fg)" font-size="9" text-anchor="middle">against world state,</text>
        <text x="433" y="132" fill="var(--muted)" font-size="9" text-anchor="middle">binds variables</text>
        <line x1="512" y1="102" x2="542" y2="102" stroke="#1158ff" stroke-width="1.75" marker-end="url(#htnArrow)"/>
        <rect x="546" y="70" width="126" height="64" rx="6" fill="var(--surface-2)" stroke="var(--border)" stroke-width="1.25"/>
        <text x="609" y="98" fill="var(--fg)" font-size="10.5" text-anchor="middle" letter-spacing="0.5">SOLUTION</text>
        <text x="609" y="116" fill="var(--muted)" font-size="10" text-anchor="middle">(item banana)</text>
        <line x1="672" y1="102" x2="702" y2="102" stroke="#1158ff" stroke-width="1.75" marker-end="url(#htnArrow)"/>
        <rect x="706" y="46" width="106" height="112" rx="6" fill="none" stroke="var(--border)" stroke-width="1.25" stroke-dasharray="5 3"/>
        <text x="759" y="68" fill="var(--fg)" font-size="9.5" text-anchor="middle">CONCRETE TASKS</text>
        <text x="759" y="90" fill="var(--muted)" font-size="9" text-anchor="middle">!take banana</text>
        <text x="759" y="106" fill="var(--muted)" font-size="9" text-anchor="middle">prepare banana</text>
        <text x="759" y="122" fill="var(--muted)" font-size="9" text-anchor="middle">!eat banana</text>
        <text x="414" y="204" fill="var(--muted)" font-size="9" text-anchor="middle" letter-spacing="1">DESIGNER-AUTHORED BRANCHES, CHECKED IN ORDER · MORE STRUCTURE, LESS OPEN-ENDED SEARCH THAN GOAP</text>
      </svg>
    </div>
  </div>
  <figcaption>How Horizon Zero Dawn's HTN planner actually decomposes a task, redrawn from Guerrilla's own GDC deck.[^14]</figcaption>
</figure>

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
hardware that doesn't get a respawn.[^10] It's not just an underwater-robotics
curiosity, either — RWTH Aachen's Institute for Gripping Systems and
Manipulators has written up the same PDDL-and-ROSPlan approach applied to
collaborative task planning for industrial robots, which is a good sign that
this is a general robotics pattern and not a one-off research demo.[^15]

<figure class="diagram-block">
  <div class="terminal-window">
    <div class="terminal-bar">
      <span class="dots"><span class="dot r"></span><span class="dot y"></span><span class="dot g"></span></span>
      ~/rosplan/architecture.svg
    </div>
    <div style="padding:1.25rem">
      <svg viewBox="0 0 828 218" style="width:100%;height:auto" role="img" aria-label="Sensor data continuously informs the ROSPlan knowledge base and planning system, which dispatches a plan as ROS actions to lower-level controllers that react to immediate situations" font-family="var(--font-mono)">
        <defs>
          <marker id="rpArrow" viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,1 L9,5 L0,9 z" fill="#3d84ff"/></marker>
          <marker id="rpArrowG" viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,1 L9,5 L0,9 z" fill="#28c840"/></marker>
        </defs>
        <rect x="16" y="68" width="150" height="80" rx="6" fill="var(--surface-2)" stroke="#3d84ff" stroke-width="1.5"/>
        <text x="91" y="100" fill="#3d84ff" font-size="11" text-anchor="middle" letter-spacing="0.5">SENSOR DATA</text>
        <text x="91" y="120" fill="var(--muted)" font-size="9" text-anchor="middle">continuous stream</text>
        <line x1="166" y1="108" x2="196" y2="108" stroke="#3d84ff" stroke-width="1.75" marker-end="url(#rpArrow)"/>
        <rect x="200" y="34" width="232" height="148" rx="6" fill="var(--surface-2)" stroke="#1158ff" stroke-width="2"/>
        <text x="316" y="56" fill="#1158ff" font-size="12" font-weight="600" text-anchor="middle" letter-spacing="1">ROSPLAN FRAMEWORK</text>
        <rect x="216" y="68" width="96" height="42" rx="4" fill="none" stroke="var(--border)" stroke-width="1"/>
        <text x="264" y="93" fill="var(--fg)" font-size="9" text-anchor="middle">Knowledge Base</text>
        <rect x="320" y="68" width="96" height="42" rx="4" fill="none" stroke="var(--border)" stroke-width="1"/>
        <text x="368" y="93" fill="var(--fg)" font-size="9" text-anchor="middle">Planning System</text>
        <text x="316" y="132" fill="var(--muted)" font-size="9" text-anchor="middle">builds a PDDL problem instance,</text>
        <text x="316" y="146" fill="var(--muted)" font-size="9" text-anchor="middle">dispatches the resulting plan</text>
        <text x="316" y="162" fill="var(--muted)" font-size="9" text-anchor="middle">as ROS actions</text>
        <line x1="432" y1="108" x2="462" y2="108" stroke="#28c840" stroke-width="1.75" marker-end="url(#rpArrowG)"/>
        <rect x="466" y="68" width="158" height="80" rx="6" fill="var(--surface-2)" stroke="#28c840" stroke-width="1.5"/>
        <text x="545" y="98" fill="#28c840" font-size="10.5" text-anchor="middle" letter-spacing="0.5">LOW-LEVEL CONTROLLERS</text>
        <text x="545" y="116" fill="var(--muted)" font-size="9" text-anchor="middle">execute the dispatched action,</text>
        <text x="545" y="130" fill="var(--muted)" font-size="9" text-anchor="middle">react in the moment</text>
        <text x="414" y="200" fill="var(--muted)" font-size="9" text-anchor="middle" letter-spacing="1">SAME SHAPE AS THE F.E.A.R. LOOP · SENSE WORLD STATE, PLAN, DISPATCH, REACT, REPLAN</text>
      </svg>
    </div>
  </div>
  <figcaption>ROSPlan's real architecture, redrawn from Cashmore et al.'s own Figure 1 — a PDDL planner embedded directly into ROS.[^10]</figcaption>
</figure>

## So is any of this actually deployed, and is it the same algorithm?

Two honest caveats belong here before going further. First: nobody outside
games calls it "GOAP." That's Orkin's term, coined for *F.E.A.R.* Outside
games, what's running is the wider STRIPS/PDDL family — the same lineage,
different name, and usually a different implementation entirely. Second: what
actually ships in a production robotics or defense system is genuinely
different from what runs in a game, for reasons that come straight from the
constraints each one is under.

A game's planner has a frame budget — GOAP has to produce a plan in
milliseconds, every time the world changes meaningfully, using a small,
hand-authored action set, with heuristics tuned for "good enough, right now"
rather than optimal. Academic and industrial PDDL planners don't carry that
constraint the same way: competition-winning planners like Fast Downward and
its LAMA extension — built on finite-domain state variables and landmark
heuristics, and the strongest performer in the IPC 2008 satisficing
track — can spend seconds to minutes searching a far larger space, because
they typically replan on a slower cadence, not once a frame.[^18] PDDL itself
is also just a richer language than what GOAP typically needs: PDDL2.1 added
*durative actions* with separate start/end/over-all conditions and continuous
numeric effects, so a real planner can reason about how long an action takes
and what fuel or battery it costs — not just whether its preconditions hold.
A 2010 ICAPS position paper by Bartheye and Jacopin looked at this gap from
the other side, asking what it would actually take to run full PDDL,
temporal features and all, inside a real-time game — and the honest answer
was: real engineering compromises, not a drop-in swap.[^19] Neither format is
"more correct" than the other; they're solving the same class of problem
under very different clocks.

The other real difference is architectural, and it's already visible in the
ROSPlan diagram above: production systems essentially never run one flat
planner and call it a day. They split a slow, deliberative layer — the
PDDL/HTN planner, replanning on a cadence of seconds to minutes — from a fast
reactive layer underneath that handles moment-to-moment control and doesn't
wait on the planner to avoid an obstacle. That's not a game-AI compromise;
it's the standard shape of a real autonomy stack, precisely because a
symbolic planner searching a rich state space cannot also be the thing
keeping a vehicle from hitting something in the next 50 milliseconds.

As for whether any of this actually reaches production instead of staying in
a research paper: the clearest public evidence isn't a press release, it's a
patent filing. US Patent 11,960,994 B2, *"Artificial Intelligence-Based
Hierarchical Planning for Manned/Unmanned Platforms,"* granted in 2024 to SRI
International — the same institute that published STRIPS in 1971 — describes
a three-layer hierarchy for coordinating a mixed team of manned and unmanned
platforms: a global layer setting a collective goal, a platform layer
assigning each platform its own goal, and a control layer executing it.[^20]
Notably, it doesn't use classical symbolic search at all — it applies
hierarchical reinforcement learning at each layer instead. That's the honest
state of the art: the STRIPS-descended symbolic branch (GOAP, PDDL, ROSPlan)
and a learned hierarchical-policy branch are both live approaches to the same
coordination problem, and which one a given team reaches for depends on how
cleanly the domain can be written down as preconditions and effects versus
how much of it needs to be learned from data. We can't point to a specific
fielded weapons platform and name its planner — that level of detail about
operational defense systems isn't public, and claiming otherwise would be
dishonest. What *is* verifiable is that organizations with real defense and
industrial R&D budgets are actively filing IP and publishing production-
adjacent research on exactly this problem, right now, not as a decades-old
theoretical curiosity.

The starkest public evidence, though, isn't a research patent — it's a
fielded weapon. STM's KARGU, a small quadrotor loitering munition built by
the Turkish state-owned defense firm, has publicly demonstrated swarm
strikes under a single operator, which STM attributes to its own "swarm
intelligence software" coordinating units without a central
controller.[^21] How much of that is autonomous decision-making versus
operator direction is exactly the question at the center of a live legal and
policy fight: a March 2021 UN Panel of Experts report on the conflict in
Libya described Kargu-2 munitions as having "hunted down and remotely
engaged" retreating forces, "programmed to attack targets without requiring
data connectivity between the operator and the munition."[^22] The report
stopped short of confirming an autonomous kill, and independent reviewers
have since noted it doesn't establish whether the system was operating
autonomously or under direct control at that moment — Turkey has disputed
the characterization.[^23] We're not going to speculate about what algorithm
is actually running inside a system whose manufacturer has never published
that detail. What's verifiable, and what actually matters for this article,
is narrower: distributed swarm task allocation of the kind described above
is no longer confined to games, labs, and patents.

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
collect them, reliably, before anyone acts. The other common family of
answers is optimization-based scheduling — a 2022 *Remote Sensing* paper on
UAV swarm task allocation for emergency observation, for instance, decomposes
the mission and solves the assignment with particle swarm optimization.[^16]
That works well too, but it shares the same quiet assumption: a planner
(auction or optimizer) computes an assignment somewhere, then distributes it
— which presumes "somewhere" can reach everyone.

That assumption is exactly the one that doesn't survive contact with a
defense UAV/UGV swarm scenario. DARPA's OFFSET program is the clearest public
statement of where military swarm research has been heading: swarms of 250+
air and ground robots in contested urban environments, where — in DARPA's own
framing — *"the swarm commander defines the mission plan, while vehicles
self-allocate and autonomously execute that plan."*[^12][^13] By the second
swarm sprint, the program's own framing had shifted toward human-swarm
teaming — how one operator directs dozens of robots through mixed-reality
interfaces — which only sharpens the point: the more robots per operator, the
less realistic it is that every one of them keeps a reliable channel open at
the moment it matters.[^17] Self-allocate, under jamming, GPS denial, and a
link to the operator that is explicitly
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

This is exactly the framing [SPU](/products/spu), our own companion-computer
hardware, is built for — not a general autonomy platform, a coordination
layer for precisely this scenario. Search-and-rescue and defense are the two
buyers who need a swarm that keeps self-allocating and executing when the
link to the operator degrades or disappears, and who can't get that property
from anything built around a live channel back to a ground station.

## A worked example

None of this gets tested by flying a real airframe first. A goal/action model
like the one below gets built and broken in simulation — commonly ArduPilot's
software-in-the-loop running a vehicle model inside Gazebo, watching a
simulated quadcopter fly a simulated mission before anything touches real
hardware.

<figure class="diagram-block">
  <img src="/assets/notes/gazebo-sim.webp" alt="Gazebo Sim showing a simulated quadcopter model (iris_with_gimbal) on a runway, with its entity tree and pose gizmo visible" loading="lazy" style="width:100%;height:auto;border-radius:6px;border:1px solid var(--border)" />
  <figcaption>Gazebo Sim running a simulated quadcopter for ArduPilot SITL testing. Image via <a href="https://medium.com/@sanjana_dev9/how-to-set-up-ardupilot-sitl-with-gazebo-for-drone-simulation-a0d15e19b8e3">"How to Set Up ArduPilot SITL with Gazebo for Drone Simulation," Sanjana Dev, Medium</a>.</figcaption>
</figure>

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
      <svg viewBox="0 0 824 320" style="width:100%;height:auto" role="img" aria-label="Top row: ground control linked to three aircraft, each sweeping an assigned cell. Bottom row: aircraft A's uplink to ground control is jammed, so it relays its report through aircraft B over the mesh instead" font-family="var(--font-mono)">
        <defs><marker id="lcArrow" viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,1 L9,5 L0,9 z" fill="#1158ff"/></marker></defs>
        <text x="412" y="22" fill="var(--muted)" font-size="10" text-anchor="middle" letter-spacing="1.4">ALL UPLINKS UP</text>
        <rect x="20" y="38" width="120" height="76" rx="6" fill="var(--surface-2)" stroke="var(--border)" stroke-width="1.25"/>
        <text x="80" y="70" fill="var(--fg)" font-size="12" text-anchor="middle" letter-spacing="0.8">GC</text>
        <text x="80" y="90" fill="var(--muted)" font-size="9" text-anchor="middle">operator</text>
        <line x1="140" y1="60" x2="196" y2="60" stroke="#1158ff" stroke-width="1.5"/>
        <line x1="140" y1="76" x2="356" y2="76" stroke="#1158ff" stroke-width="1.5"/>
        <line x1="140" y1="92" x2="516" y2="92" stroke="#1158ff" stroke-width="1.5"/>
        <rect x="198" y="38" width="120" height="76" rx="6" fill="var(--surface-2)" stroke="var(--border)" stroke-width="1.25"/>
        <text x="258" y="70" fill="var(--fg)" font-size="12" text-anchor="middle" letter-spacing="0.8">A</text>
        <text x="258" y="90" fill="var(--muted)" font-size="9" text-anchor="middle">sweeping cell 1</text>
        <rect x="358" y="38" width="120" height="76" rx="6" fill="var(--surface-2)" stroke="var(--border)" stroke-width="1.25"/>
        <text x="418" y="70" fill="var(--fg)" font-size="12" text-anchor="middle" letter-spacing="0.8">B</text>
        <text x="418" y="90" fill="var(--muted)" font-size="9" text-anchor="middle">sweeping cell 2</text>
        <rect x="518" y="38" width="120" height="76" rx="6" fill="var(--surface-2)" stroke="var(--border)" stroke-width="1.25"/>
        <text x="578" y="70" fill="var(--fg)" font-size="12" text-anchor="middle" letter-spacing="0.8">C</text>
        <text x="578" y="90" fill="var(--muted)" font-size="9" text-anchor="middle">sweeping cell 3</text>
        <line x1="20" y1="150" x2="804" y2="150" stroke="var(--border)" stroke-width="1" stroke-dasharray="3 4"/>
        <text x="412" y="182" fill="var(--muted)" font-size="10" text-anchor="middle" letter-spacing="1.4">A's UPLINK JAMMED · MESH TO B AND C STILL UP</text>
        <rect x="20" y="198" width="120" height="82" rx="6" fill="none" stroke="var(--border)" stroke-width="1.25" stroke-dasharray="5 3"/>
        <text x="80" y="230" fill="var(--muted)" font-size="12" text-anchor="middle" letter-spacing="0.8">GC</text>
        <text x="80" y="250" fill="var(--muted)" font-size="9" text-anchor="middle">gets report</text>
        <text x="80" y="263" fill="var(--muted)" font-size="9" text-anchor="middle">via B</text>
        <rect x="198" y="198" width="120" height="82" rx="6" fill="none" stroke="var(--muted)" stroke-width="1.25" stroke-dasharray="4 3"/>
        <text x="258" y="228" fill="var(--fg)" font-size="12" text-anchor="middle" letter-spacing="0.8">A</text>
        <text x="258" y="248" fill="var(--muted)" font-size="9" text-anchor="middle">found target</text>
        <text x="258" y="261" fill="var(--muted)" font-size="9" text-anchor="middle">uplink ✕</text>
        <rect x="358" y="198" width="120" height="82" rx="6" fill="var(--surface-2)" stroke="#1158ff" stroke-width="2"/>
        <text x="418" y="228" fill="#1158ff" font-size="12" font-weight="600" text-anchor="middle" letter-spacing="0.8">B</text>
        <text x="418" y="248" fill="var(--fg)" font-size="9" text-anchor="middle">relaying for A</text>
        <rect x="518" y="198" width="120" height="82" rx="6" fill="var(--surface-2)" stroke="var(--border)" stroke-width="1.25"/>
        <text x="578" y="228" fill="var(--fg)" font-size="12" text-anchor="middle" letter-spacing="0.8">C</text>
        <text x="578" y="248" fill="var(--muted)" font-size="9" text-anchor="middle">sweeping cell 3</text>
        <line x1="140" y1="228" x2="196" y2="228" stroke="var(--muted)" stroke-width="1.4" stroke-dasharray="3 3"/>
        <text x="150" y="220" fill="var(--muted)" font-size="11" text-anchor="middle">✕</text>
        <line x1="322" y1="228" x2="352" y2="228" stroke="#1158ff" stroke-width="1.75" marker-end="url(#lcArrow)"/>
        <path d="M362,296 L142,296 L142,282" fill="none" stroke="#1158ff" stroke-width="1.75" marker-end="url(#lcArrow)"/>
        <text x="410" y="300" fill="var(--muted)" font-size="9" text-anchor="middle" letter-spacing="0.6">RelayReport routes A &#8594; B &#8594; GC over the mesh · reportSent = true</text>
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
runtime — its current C++17 rewrite lives in its own repository, fleece-ng —
is a GOAP-class planner running identically on every node: goals and actions
authored as data, gossip-synchronized shared state instead of a central
coordinator, and a CBBA-style scored claim riding on that same gossip instead
of a live bidding channel — a real, running instance of exactly the
market-based task allocation Gerkey and Matarić's taxonomy describes,[^11]
minus the channel it normally assumes. Every unit scores a goal by how far its
own state is from the goal's, so the same number that ranks a claim ranks the
plan — and every unit plans and replans for itself, on-board, with no operator
in the decision loop and no central coordinator to lose. That's fleece's
general model, and it's what a team building directly on fleece gets. [The
SPU](/products/spu), our companion-computer hardware, runs a narrower
deployment of the same runtime: a fixed action library provisioned on-board as
flash data (`takeoff`, `goto`, `return_home`, `scan`, `deliver`, and
`climb`/`dive` for time-critical goals) rather than custom-authored ones, with
only the goals varying per mission. Either way, cutting the link to the
operator doesn't stop a swarm from finishing the mission it was already
flying, for the same reason: neither shape ever depended on that link being
up.

The RelayReport example above is illustrative. The real mechanism goes one
step further, and it's worth being concrete about it because it's shipped,
not hypothetical: a native watchdog running on every unit — underneath the
planner, not part of it, the same relationship the fast reactive layer has to
the slow deliberative one in the ROSPlan diagram above — watches its own
locally-visible peer set. When it shrinks in a way that looks like a real
split rather than one flickering radio tick, and this unit ends up on the
smaller side of that split, the watchdog does the only thing anything in this
architecture ever does to change behavior: it writes an ordinary goal into
the shared pool, `goto` toward the last-known position of whoever it lost.
No new action. No `link_down` state anywhere in the planner. No fallback
branch. The same auction that claims a search cell claims this goal too, the
same way, and whichever unit's plan it becomes just flies it. That's this
article's whole thesis, not applied to a game AI's door — applied to a real
swarm noticing it fragmented and re-forming, because nothing about how any of
it decides what to do next ever assumed the link, or even the rest of the
swarm, would stay in one piece.

That's a GOAP-class planner, not a PDDL one, and given the rest of this
article that's worth being direct about: it's a deliberate fit, not a
shortcut. Everything said above about why full PDDL planners can afford
richer temporal and numeric reasoning — Fast Downward, LAMA, seconds of
search time — comes with the same condition attached: they get that budget
by replanning on a slower cadence, on hardware that can spare it. fleece
doesn't get that luxury. It runs on hardware sized for a microcontroller
rather than a companion computer, keeps the plan it has and replans in place
the moment the world invalidates it, and does the whole search under a hard
per-tick node budget — the same frame-budget discipline that pushed Orkin
toward GOAP in the first place, not a heavier symbolic planner. What it *has*
picked up is a bounded slice of the temporal reasoning that makes PDDL richer:
a goal can carry a deadline, and the planner quantizes each action's duration
into whole ticks so it can refuse a goal the vehicle cannot physically reach
in time — at claim time, before the unit commits to it — rather than accept it
and miss. That's real time-and-feasibility reasoning kept inside the frame
budget, not the seconds-long search a full temporal planner would spend on it.
A slower, full-PDDL layer sitting above the real-time one — for missions that
actually call for that extra reach — is still a real possibility we're
watching rather than a promise with a date on it; because fleece's goals and
actions are already just data rather than compiled logic, nothing in the
architecture rules it out.

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
[^14]: Guerrilla Games. ["The AI of Horizon Zero Dawn."](https://www.guerrilla-games.com/media/News/Files/The-AI-of-Horizon-Zero-Dawn.pdf) *Game Developers Conference* slide deck (official PDF).
[^15]: Ruland, S. W. (2020). ["Aufgabenplanung in industriellen Szenarien" (Task planning in industrial scenarios).](https://blog.rwth-aachen.de/robotik/en/aufgabenplanung-in-industriellen-szenario/) *IGMR Robotik Blog, RWTH Aachen University.*
[^16]: Liu, J. L., Liao, X. H., Ye, H. P., Yue, H. Y., Wang, Y., Tan, X., & Wang, D. L. (2022). ["UAV Swarm Scheduling Method for Remote Sensing Observations during Emergency Scenarios."](https://doi.org/10.3390/rs14061406) *Remote Sensing, 14*(6), 1406.
[^17]: Defense Update. ["DARPA Studies Human-Swarm Interactions."](https://defense-update.com/20181014_swarm_sprint.html)
[^18]: Richter, S., & Westphal, M. (2010). ["The LAMA Planner: Guiding Cost-Based Anytime Planning with Landmarks."](https://www.jair.org/index.php/jair/article/download/10667/25496/19843) *Journal of Artificial Intelligence Research, 39*, 127–177. See also: [The Fast Downward Planning System](https://arxiv.org/pdf/1109.6051), Helmert, T. (2006).
[^19]: Bartheye, O., & Jacopin, É. (2010). ["Real-Time Planning for Video-Games: A Purpose for PDDL."](https://skatgame.net/mburo/icaps2010-pg/ICAPS-PG.2010.1.bartheye.pdf) *ICAPS 2010 Workshop on Planning in Games.*
[^20]: Chiu, H.-P., et al. (2024). ["Artificial Intelligence-Based Hierarchical Planning for Manned/Unmanned Platforms."](https://patents.google.com/patent/US11960994B2) US Patent 11,960,994 B2, assigned to SRI International.
[^21]: STM. ["KARGU — Combat-Proven Rotary Wing Loitering Munition System."](https://www.stm.com.tr/en/kargu-autonomous-tactical-multi-rotor-attack-uav) See also: [STM Executes Türkiye's First Live-Fire Drone Swarm Using 20 KARGU Loitering Munitions — Army Recognition](https://www.armyrecognition.com/news/aerospace-news/2026/stm-executes-tuerkiyes-first-live-fire-drone-swarm-using-20-kargu-loitering-munitions).
[^22]: Domonoske, C. (2021). ["A U.N. Report Suggests Libya Saw The First Battlefield Killing By An Autonomous Drone."](https://www.npr.org/2021/06/01/1002196245/a-un-report-suggests-libya-saw-the-first-battlefield-killing-by-anautonomous-d) *NPR.*
[^23]: Hambling, D. (2021). ["Was A Flying Killer Robot Used In Libya? Quite Possibly."](https://thebulletin.org/2021/05/was-a-flying-killer-robot-used-in-libya-quite-possibly/) *Bulletin of the Atomic Scientists.*
