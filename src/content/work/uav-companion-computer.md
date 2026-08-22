---
title: "PX4 companion computer for an agricultural survey fleet"
summary: "A custom companion computer, onboard image processing pipeline, and PX4 integration for a multi-aircraft survey fleet."
client: "Agtech operator"
year: "2025"
discipline: ["Hardware", "Firmware", "Software"]
tags: ["PX4", "Companion computer", "Image processing", "Embedded Linux"]
featured: true
placeholder: true
---

## The problem

The client's survey aircraft were flying missions and hauling raw imagery back to
a ground station for processing hours later — fine for a single aircraft, not
fine for a fleet where a bad flight (out-of-focus imagery, a missed strip) needs
to be caught while the aircraft is still in the air.

## What we built

**Hardware.** A ruggedized companion computer board sized to the airframe's
payload bay, carrying enough compute for onboard inference without blowing the
power or thermal budget.

**Software.** An onboard image processing pipeline that flags coverage gaps and
focus issues in near-real time, streaming a low-bandwidth preview back over the
datalink instead of nothing until landing.

**Integration.** PX4 companion computer integration over MAVLink — mission
status, health telemetry, and pipeline flags surfacing in the same ground control
picture the operators already used, not a second app to babysit.

## Outcome

Bad flights get caught mid-mission instead of after a multi-hour processing
backlog, cutting wasted re-flights significantly across the fleet.

*(Placeholder case study — replace with a real engagement once you have one to publish.)*
