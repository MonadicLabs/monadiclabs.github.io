---
title: "The swarm that never syncs: teaching robots to share a world-state over one bad radio"
description: "A 250 kbps shared radio, 12 robots, one JSON world-view. Naive gossip never converges. Rateless set reconciliation doesn't care. Here's the idea, the numbers, and everything we broke on the way."
date: 2026-09-22
tags: ["Robotics", "Distributed Systems", "Networking", "Swarm", "Simulation"]
placeholder: false
---

All figures below are generated from the simulator itself (seed 42, identical radios and schedules on both sides of every comparison). Regenerate them any time: `python3 blog/figs.py main`, `python3 blog/figs.py track`, `python3 blog/figs.py baselines`, `python3 blog/schematics.py`, then rasterize with
`cd blog/img && for f in *.svg; do rsvg-convert -o "${f%.svg}.png" "$f"; done`.

<figure class="diagram-block">
  <img src="/assets/notes/swarm/hero_map.png" alt="12 robots sharing one channel" loading="lazy" style="width:100%;height:auto;border-radius:6px;border:1px solid var(--border)" />
  <figcaption>The arena: 12 robots, one shared 250 kbps channel, MTU 250 B, half-duplex, hidden terminals. The shaded discs are comm range; the lines are who can hear whom. Every robot is trying to end up holding the same JSON object.</figcaption>
</figure>

## The problem

Picture N robots, no infrastructure, each holding its own replica of a shared **world-state** — a JSON object with battery levels, positions, task claims, flags. A planner on every robot reads this view to decide what to do. Two robots deciding from divergent views is a bug factory: the point of the whole system is that everyone eventually agrees on *exactly the same object*.

The radios are the cheap kind:

- 250 kbps of **shared airtime** — one channel, everyone hears everyone (in range)
- MTU 250 bytes
- hidden terminals collide, half-duplex, random loss, bursty fading
- robots move, so the mesh topology breathes; partitions happen
- no coordinator, no schedule, no base station

So: what do you broadcast, and when?

## The obvious answer dies

The obvious answer is to broadcast your **full state** whenever it changes (plus a refresh for new listeners). This is what people actually deploy, so we built it as a baseline (`--mode naive`) with identical radios, schedules, and last-writer-wins semantics. Default scenario: 12 robots, ~100 writes over 50 s.

<figure class="diagram-block">
  <img src="/assets/notes/swarm/head2head.png" alt="naive vs rateless head to head" loading="lazy" style="width:100%;height:auto;border-radius:6px;border:1px solid var(--border)" />
  <figcaption>Same scenario, same radio, same schedule. Full-state gossip moves 2.9x the bytes, occupies twice the airtime, causes 3.8x the collisions — and still never converges.</figcaption>
</figure>

<figure class="diagram-block">
  <img src="/assets/notes/swarm/mesh_cdf.png" alt="propagation delay CDF" loading="lazy" style="width:100%;height:auto;border-radius:6px;border:1px solid var(--border)" />
  <figcaption>How long each write took until every robot held it (write-to-full-mesh delay). Rateless: every update lands, mean 1.2 s. Naive: updates stretch past 8 s at the tail, and one never arrives at all.</figcaption>
</figure>

Then we grew the shared world to 1,500 keys while keeping the *update rate* fixed — the interesting regime where the state is big but the deltas are small. Naive saturates at ~1.8 MB and **never converges at any size we tried**; its transmit queues simply cannot emit the state fast enough. Rateless barely notices the difference.

That's the one-line summary of the whole project:

> **Communication cost scales with the difference between states, not with the size of the states.**

Full-state gossip costs `state x peers` per refresh and re-floods on every change. Rateless reconciliation costs `difference x peers`, once, regardless of how large the world becomes. (Keep in mind what kind of comparison this is: naive isn't a worse constant — it's a different scaling class. We get to the right yardstick a few sections down.)

## The idea, in three paragraphs

**Set reconciliation.** Two robots hold sets A and B; the only interesting quantity is the symmetric difference A△B. An IBLT (Inverse Bloom Lookup Table) encodes a set as a table of cells, each holding an XOR-sum of hashed elements mapped into it. Two such tables, subtracted cell-by-cell, encode exactly A△B — and the difference can be *peeled*: a cell whose checksum says "I contain exactly one element" reveals it, and you cancel that element everywhere it maps, which may unlock more cells, and so on. Recover the difference with work proportional to |A△B|, not |A∪B|.

<figure class="diagram-block">
  <img src="/assets/notes/swarm/peel.png" alt="how peeling works" loading="lazy" style="width:100%;height:auto;border-radius:6px;border:1px solid var(--border)" />
  <figcaption>Two sets of six with four differing elements: subtract the tables, three cells are immediately pure, and peeling k5 makes a fourth cell pure in cascade. Whether the sets hold 6 keys or 60,000, this picture needs exactly the same number of peels.</figcaption>
</figure>

**Rateless.** The paper behind this — *Practical Rateless Set Reconciliation* (Yang, Gilad, Alizadeh, SIGCOMM 2024) — makes the encoder rateless: symbols are generated on demand from an infinite stream, where element `i` maps to index `j` with probability rho(j) ≈ 1/(1 + j/2). Each symbol is a self-contained slice (a 48-byte sum, an 8-byte keyed checksum, a start index). Any subset of transmitted packets is useful; there is no ordering, no retransmission, and crucially **no stop signal** — the sender just transmits while it has something to say and receivers accumulate.

**As world-state.** Our robots flatten their JSON world-view to dotted scalar keys (`r03.bat = 87`, `task1.st = "open"`), and every write becomes a 48-byte entry: `key | Lamport timestamp | value`, appended to an entry set whose per-key maximum-ts version *is* the live view (last-writer-wins, deliberately — every field has a single authority, so the concurrent-merge cases CRDTs exist for don't arise here). The robot's rateless encoder carries its entry set; symbols ride in 250 B packets across the mesh.

<figure class="diagram-block">
  <img src="/assets/notes/swarm/wire.png" alt="wire format" loading="lazy" style="width:100%;height:auto;border-radius:6px;border:1px solid var(--border)" />
  <figcaption>Everything on air is one of three frames: the 48-byte entry, the ≤250 B coded burst (4 symbols per packet, each self-describing), and the raw hot packet used by the hot tier below. Keyed checksums and frame MACs authenticate all of them.</figcaption>
</figure>

## What the paper doesn't give you

The paper's protocol is **two-party, with a stop signal and a session**. A swarm is neither: there is no "the other side", no moment where "done" is defined, and neighbors churn constantly. We wanted the transport to be truly stateless — **no handshakes, no sessions, no ACKs, no per-peer protocol state** — because every one of those is a liability in an environment that changes under you. Getting there took three redesigns, each fixing a real observed failure:

**1. Pairwise streams, not one mixed buffer.** The naive peel walk mutates a shared symbol buffer, and in many-party gossip that buffer is a function of *every* neighbor's state. It drifts: repeated content XORs in, residues from stale eras poison the arithmetic, and coverage collapses (residue counts in the hundreds where pure cells should exist). The fix: never mutate symbol state. Each receiver derives, on demand, one buffer per sender — `sender(j) − own(j) + hush(j)` — and peels from that.

**2. Own-stream cancellation and hush streams.** When a robot peels a foreign element, it cancels the element in *its own* symbol stream (exact, drift-free — replacing the classic peel walk). When a robot's own advertisement shows up as a residual in someone's stream, a per-sender "hush" stream cancels it locally. Removals (garbage-collected entries) undo hush entries so nothing is permanently forgotten. This asymmetry is what lets the same arithmetic survive re-broadcasts, era changes, and set contraction with no handshake.

**3. A two-band send window.** When should a robot transmit? All the time (wastes airtime) or only on change (starves anyone who just roamed in range)? Both, cheaply:

<figure class="diagram-block">
  <img src="/assets/notes/swarm/twoband.png" alt="two-band send window" loading="lazy" style="width:100%;height:auto;border-radius:6px;border:1px solid var(--border)" />
  <figcaption>A low band ramps each changed element through its mapped indices — index 0 first (two well-chosen symbols peel a one-element difference), then a stride-3 index per visit — and an always-on sparse sweep of the whole index range heals behind receivers and newcomers. Stable content means silence: unchanged symbols are deduped by every neighbor.</figcaption>
</figure>

Under sustained churn the ramp *restarts only after it finishes* (refloods coalesce) — the earlier design restarted mid-ramp on every change, starved the sparse high indices, and produced runaway per-listener lag we could watch grow in the dashboard. That bug is why the send window slides.

The receiver side is one stateless pipeline:

<figure class="diagram-block">
  <img src="/assets/notes/swarm/pipeline.png" alt="receive pipeline" loading="lazy" style="width:100%;height:auto;border-radius:6px;border:1px solid var(--border)" />
</figure>

A robot that merged something enrolls it for relaying — that is the entire multi-hop "routing" story. **No routes, no neighbor protocol, no join handshake**: a robot that roams back in range just starts collecting symbols from whoever is audible and decodes opportunistically.

## The hot tier

Some fields can't wait ~a second: when a robot says "my position at 2 Hz", its peers should see it within a human-plausible reaction time, and that means hopping the reconciliation queue. So ego-written entries (single-writer fields, verifiable by timestamp) also go out **raw** — 48-byte entries packed directly, preempting the coded-traffic queue — with one blind retry, and neighbors relay them once at p=0.25 with one-shot dedup. Everything else stays on the reconciliation backbone.

<figure class="diagram-block">
  <img src="/assets/notes/swarm/hot_cdf.png" alt="hot tier latency" loading="lazy" style="width:100%;height:auto;border-radius:6px;border:1px solid var(--border)" />
  <figcaption>Write-to-first-peer-copy delay, hot tier on vs off, same run. Median 300 ms vs 966 ms — and the low end of the hot curve starts at ~8 ms, which is what a direct neighbor hears.</figcaption>
</figure>

## Why this is close to optimal

Three floors bound what any reconciliation protocol can do here, and the system sits within a small constant of each.

**The information floor.** Any protocol that doesn't know in advance which elements differ — ours deliberately doesn't — must, in the worst case, move the difference itself: an adversary can always choose the `d` differing elements to be unpredictable, and a receiver cannot reconstruct elements it never received information about. So `Ω(d)` element transfers is a hard floor. On a broadcast channel there is a second, bigger gift: **one transmission serves every listener**. The cost is set by the most out-of-date listener's difference — the *max* over receivers, not the sum. Unicast delta-sync protocols pay the sum (or pay N sessions to approximate it); broadcast reconciliation pays the max.

**The constant factor.** Measured directly in our codec (receiver peeling against its own stream): **1.43 symbols per difference element at diff = 4,000, 1.8 at diff = 400** — and the part that matters, *flat as the shared set grows 100-fold* (1.76 vs 1.88 symbols/element with 20,000 vs 40,000 shared elements behind the difference). Against an oracle that teleports exactly the `d` missing 48-byte entries, that is roughly **2x the bytes** — the price of needing zero knowledge of who needs what, of surviving any packet-loss pattern without feedback, and of never needing a stop signal. The asymptote (1.35x, from the paper's rho mapping with alpha = 0.5) is a property of the code, not a tuned parameter.

**The channel floor.** One full-swarm update needs ~35 ms of pure airtime at 250 kbps (11 relays x ~100 B); the measured sustained tracking rate is ~5-6 writes/s — within ~2x of that physics, the gap being CSMA backoff and collisions (ALOHA narrows it).

So the claim is not bit-optimality. It is: flat in |S|, Θ(d) in the difference with a ~1.4-1.9x constant, one broadcast serving all listeners, zero feedback — and within ~2x of the radio's own airtime budget. No qualitative gap remains on any axis. Naive fails the first floor outright (Θ(|S|)); session-based delta protocols fail the broadcast property (per-peer or per-round-trip costs). We'd expect any fair successor on this radio to look a lot like this — and below, two of the rival families are built and measured, not just argued.

## The baselines, measured

Naive full-state dumps are a weak opponent, so we built the two rivals worth taking seriously and gave them the same radio, the same schedule, the same LWW semantics (`--mode flood|vv|vvk|naive`):

- **flood** — rumor mongering at full strength: every entry a robot learns (own write or heard) is broadcast raw once, deduped by the view; source writes get a blind-retry cascade. No coded stream, no digests, no backfill.
- **vv** — version-vector anti-entropy, per-writer flavour: broadcast a tiny (writer → max Lamport counter) digest every tick (N × 6 B), rebroadcast live winners a peer's digest says it lacks.
- **vvk** — the same idea with **per-key digests** (key hash + version, O(|keys|) bytes): the exact variant.

<figure class="diagram-block">
  <img src="/assets/notes/swarm/baselines_static.png" alt="baselines on a calm mesh" loading="lazy" style="width:100%;height:auto;border-radius:6px;border:1px solid var(--border)" />
  <figcaption>A calm, fully connected 12-robot mesh. Flood is 7x cheaper on bytes and 35x faster per update than rateless — the raw-push tier is doing exactly what it's designed for. And yet five robots end the run permanently wrong: one write whose every copy collided is simply gone, and nothing in flood can ever discover that.</figcaption>
</figure>

That last clause is the whole story of flood. Rumor mongering delivers **news**; it cannot deliver **state** — it has no mechanism to notice, let alone repair, a gap. You don't even need a partition: a single unlucky write does it.

Then the discriminator — same traffic, but half the swarm is killed for 12 s and revived:

<figure class="diagram-block">
  <img src="/assets/notes/swarm/baselines_partition.png" alt="baselines through a partition" loading="lazy" style="width:100%;height:auto;border-radius:6px;border:1px solid var(--border)" />
  <figcaption>One 12 s kill-half episode (t=20, revive at t=32). Rateless heals completely: zero robots wrong, zero updates lost, at 703 kB (+22% vs calm — that's what self-healing costs). Flood leaves 6 robots permanently wrong — 23 updates never propagate, ever. Naive heals too, the only way it can: brute force, 12.4 s at 56% airtime. vv and vvk heal via digest-driven rebroadcast.</figcaption>
</figure>

Flood is the reason reconciliation exists; that's now a measurement, not an aphorism. The VV side taught us two things we did not expect:

**1. Digest-triggered responses self-synchronize into a collision storm.** The first vv draft rebroadcast missing entries *instantly* on digest receipt. Every digest therefore detonated all of the sender's neighbors at the same microsecond — and the collisions landed exactly on the head of the node that needed the data: we watched one robot miss ten consecutive rebroadcast attempts, every one killed by the same hidden-terminal pair (two neighbors, invisible to each other, both answering the same digest). Any request-driven broadcast response on a half-duplex radio needs a **randomized response delay** — ours is 0.02-0.35 s plus a 1 s digest rate-limit, and there's a test locking the lesson in.

**2. Per-writer counter digests are structurally blind on a reordering fabric.** A VV digest reports each writer's *max* Lamport counter. Instrumented trace: r3's digest said "writer r1 is at counter 17" — learned via an unrelated task key — while r3 actually held r01.bat at counter 16. r1 computed "nothing missing" and never re-sent; r3 stayed stale forever, silently. Any missed mid-sequence write is invisible the moment any *later* write from that writer arrives — and broadcast delivery reorders by design (hot tier, one-shot relays, collisions). Sessions preserve order; sessions are precisely what this fabric refuses to have. **Per-writer VV anti-entropy cannot be made correct here at any byte cost** (test-locked: the partition strands 2 robots permanently).

The exact fix is per-key digests — **vvk heals everything, zero robots wrong** — but look at the price: 1,075 kB on air and **51% of all airtime** on a ~100-key world, because the digest itself is now state that must ship continuously, O(|keys|) bytes per round. That's the Θ(|S|)-metadata regime that Merkle-tree and delta-sync protocols live in — no longer a structural argument, because vvk just measured it for them.

The full scorecard, both scenarios:

| mode | calm: bytes | calm: robots wrong | partition: bytes | partition: robots wrong | converges? |
|---|---|---|---|---|---|
| flood | **83 kB** | 5 | **96 kB** | **6** | never, after any gap |
| vv (per-writer digest) | 137 kB | 0 | 160 kB | 0* | yes — but structurally unsound* |
| riblt | 579 kB | **0** | 703 kB | **0** | yes |
| vvk (per-key digest) | 1075 kB | 0 | 1222 kB | 0 | yes, digest = Θ(\|S\|) metadata |
| naive | 1702 kB | 5 | 1931 kB | 0 | brute force: 12.4 s @ 56% airtime |

\* the 12-robot partition run got lucky — the blind spot is probabilistic; a test-locked run strands 2 robots permanently.

Which closes the loop on optimality: two rows of the baseline menu are now measurements, and they land exactly where the structure said they would. **Flood fails completeness** (no backfill — and no way to even notice), **VV anti-entropy fails the Θ(d)-metadata floor** (exact digests scale with state; per-writer ones scale with nothing and are wrong). Naive fails both. What's left is the only mode measured that is simultaneously difference-proportional, order-free, digest-free, and self-healing — and it keeps flood where flood is safe: the hot tier *is* a bounded flood, applied only to single-writer ego keys that re-publish continuously, where every gap self-heals on the next beat.

## The numbers

**Grow the world, keep the update rate** (`--world-keys`, 12 robots):

<figure class="diagram-block">
  <img src="/assets/notes/swarm/scale.png" alt="scaling with world size" loading="lazy" style="width:100%;height:auto;border-radius:6px;border:1px solid var(--border)" />
  <figcaption>Rateless bytes stay flat (579 -&gt; 667 kB, 1.15x for 25x more state) and it converges at every size, losing zero updates. Naive saturates at ~1.8 MB and never converges — at 1,500 keys, 97 of ~100 updates never fully propagate.</figcaption>
</figure>

**Tracking a moving robot** (r04 streams position at 2 Hz for 150 s while drifting; r03 watches):

<figure class="diagram-block">
  <img src="/assets/notes/swarm/track.png" alt="tracking delay over time" loading="lazy" style="width:100%;height:auto;border-radius:6px;border:1px solid var(--border)" />
  <figcaption>Every 2 Hz write of r04's position and when r03's view contained it. As a direct neighbor, the hot tier delivers at a 23 ms median (95% under 0.4 s). The spikes are the writer roaming out of range: delivery falls back to the reconciliation backbone or — for 17 writes — doesn't make it, because hot relaying is one-shot. The sim reports that honestly.</figcaption>
</figure>

**Capacity is physics.** One write must reach N-1 peers; each relay costs ~100 B of airtime. Sweeping the datarate grid until the swarm "tracks" (converges, zero lost, mean propagation <= 2 s):

<figure class="diagram-block">
  <img src="/assets/notes/swarm/capacity.png" alt="capacity envelope" loading="lazy" style="width:100%;height:auto;border-radius:6px;border:1px solid var(--border)" />
  <figcaption>Minimum datarate that keeps an N-robot swarm tracking. 250 kbps gives 12 robots ~2.5x headroom — but the headroom is finite: pushing 12 robots x 2 Hz = 24 full-swarm writes/s needs several times the channel. No protocol fixes that; the options are datarate, publish rate, or honest lag, and the simulator reports which one you're living in.</figcaption>
</figure>

**And the trap: FDMA spatial reuse.** We split the band into K channels with a connectivity-preserving coloring, capacity conserved by construction, three assignment strategies:

<figure class="diagram-block">
  <img src="/assets/notes/swarm/fdma_trap.png" alt="fdma paradox" loading="lazy" style="width:100%;height:auto;border-radius:6px;border:1px solid var(--border)" />
  <figcaption>Collisions fall — -47% at K=2, -96% at K=5 — and convergence dies anyway: ~100 updates never fully propagate at any K. Because broadcast IS the transport: a channel split removes listeners, and every entry must travel fewer-but-longer same-channel relay paths. Single channel + capture effect wins at this density.</figcaption>
</figure>

**Robustness**, measured, all still converging: 10% random loss (no change); bursty Gilbert-Elliott fading (5% average, 5 s outages: propagation stretches ~30%, still zero lost); ALOHA instead of CSMA (2.3x collisions, still converges); 100 kbps radio (rateless converges, naive never); 20 robots (rateless fine, naive collapses to 85% busy with 26k collisions in a sibling run).

## Traps worth knowing

- **Big blobs don't backfill through coded symbols.** For a per-stream difference of B elements, pure (peelable) symbols exist only around index j ≈ 2B — rateless repair of a ~200-entry payload against a lagging peer is glacial. Immutable, content-addressed **chunks** re-emitted on the raw channel every few seconds solve it; a 676 B waypoint blob reaches all peers byte-identical with a ~0.5 s median.
- **Auctions need monotone bids.** Our CBBA-style task allocation has no bidding *protocol* — robots write claims only to their own single-writer keys, and the winner map is a pure function of the replicated claim set: any two robots that sync the same state compute the same allocation. But the first version let bids decay, and roaming robots re-sniped forever: bids must be stable functions of geometry, or nothing settles.
- **Fuzzing earned its keep.** Arbitrary-JSON fuzz found a silent wire bug — value payloads were NUL-terminated, so any content hash ending in `0x00` truncated and *never resolved* — plus dotted-key collisions (`{"a":{"b":1}}` vs `{"a.b":1}`). Radio-frame fuzz found a DoS: a validly-authenticated frame of junk entries crashed the merge on a non-UTF-8 key. The receive path is now verified total over arbitrary bytes: no crash, no state corruption, hostile frames counted and dropped.

## What it can't do

Honest caveats, because they shape the fit:

- **LWW only.** Concurrent writes to one key resolve by (Lamport counter, robot id) — right for telemetry, flags, and single-writer claims; wrong for accumulative state. If you need counters or sets to merge, this fabric won't do it.
- **Bounded resurrection.** Deleted keys are guarded by tombstones that are GC'd after a TTL; a peer partitioned *longer than that* could resurrect a deleted key. Set the TTL above your worst-case partition time.
- **Auth is a swarm PSK** — keyed checksums and frame MACs reject outsiders and wire corruption, but a compromised node holding the key can forge. Per-writer signatures and confidentiality are link-layer/app problems, out of scope here.
- **It's a simulation.** Stylized radio (unit-disk, capture-effect interference, hidden terminals, Gilbert-Elliott fading) — a deliberately aggressive model, but not hardware. ESP-NOW and RFD900x validation is the next step, and the wire format is deliberately small and fixed to make a port feasible.

## Try it

Everything is one repo, stdlib-only Python, 424 tests: [github.com/MonadicLabs/swarm-research](https://github.com/MonadicLabs/swarm-research)

<pre class="code-block"><code>python3 sim.py --mode both          # rateless vs naive, identical schedule
python3 sim.py --world-keys 1500    # big state, small deltas
python3 webui.py --speed 10         # live dashboard: map, airtime, agreement matrix</code></pre>

The dashboard is worth the click: a map with TX rings and collision flashes, a key×robot **agreement matrix** where divergence is visible cell-by-cell, per-node world-view inspectors, and a telemetry-watch card that shows "what r4 says" vs "what r3 sees" side by side.

**Verdict:** for a thin broadcast fabric and a JSON world-state, rateless reconciliation is the rare distributed-systems idea that is both elegant and *actually simpler to operate* than the naive thing it replaces — no sessions, no routing, no retransmission, cost proportional to the difference, and within a small constant of every floor we know how to state (information, broadcast reuse, channel airtime). The state is big; the news is small; send the news.
