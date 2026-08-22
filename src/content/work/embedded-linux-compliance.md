---
title: "Embedded Linux hardening and ANSSI compliance remediation"
summary: "A Yocto-based embedded Linux image, security-hardened and brought into line with ANSSI recommendations ahead of a compliance audit."
client: "Public-sector integrator"
year: "2024"
discipline: ["Software", "Security"]
tags: ["Embedded Linux", "Yocto", "ANSSI", "Security hardening"]
featured: true
placeholder: true
---

## The problem

An existing embedded Linux platform, built up over several years without a
consistent security baseline, needed to pass an ANSSI-aligned compliance review
before a public-sector deployment could proceed. The findings from a first pass
were long, and the client had no in-house bandwidth to work through them while
also shipping features.

## What we built

**Audit.** A structured review against CIS benchmark controls and ANSSI
recommendations — filesystem permissions, service exposure, boot chain
integrity, key and secret handling, update mechanism.

**Remediation.** A rebuilt Yocto image with the findings addressed at the layer
level, not patched ad hoc on top — read-only root filesystem where the product
allowed it, a minimized service surface, and a signed, resumable OTA update path.

**Documentation.** A remediation record mapping every finding to the specific
change that closed it, in the format the compliance reviewer actually needed.

## Outcome

The platform passed its follow-up review, and the hardened Yocto layer is now
the baseline for the client's next two product lines instead of a one-off fix.

*(Placeholder case study — replace with a real engagement once you have one to publish.)*
