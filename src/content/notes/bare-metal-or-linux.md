---
title: "Bare-metal, RTOS, or embedded Linux: how we decide"
description: "The decision tree has fewer branches than it looks like — it mostly comes down to what the companion computer needs to talk to."
date: 2026-01-20
tags: ["RTOS", "Embedded Linux", "Firmware"]
placeholder: true
draft: true
---

Three options get pitched for every companion computer or flight-adjacent
board, and the honest answer is that the choice is usually forced by one
question: does this board need a real filesystem, a network stack with more
than one consumer, and a package ecosystem — or does it need to do one or two
things with hard timing guarantees and nothing else?

Bare-metal wins when the job is small and timing-critical — a sensor driver, a
motor control loop, anything where "the scheduler decided to do something else
for 3ms" is a real failure mode. An RTOS earns its keep once you have enough
concurrent tasks that hand-rolled state machines stop being simpler than a
scheduler. Embedded Linux — Yocto or a lighter distro — wins once you need
real networking, a camera pipeline, or an application ecosystem, and you can
afford the RAM, storage, and boot-time cost that comes with it.

Most of our companion-computer work ends up running embedded Linux for the
application layer next to a bare-metal or RTOS coprocessor doing the
timing-critical parts — because "which one" is often the wrong question when
"both, split correctly" is on the table.

*(Placeholder post — swap in your own field notes.)*
