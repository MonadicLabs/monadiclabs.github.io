---
title: "Synthetic data for UAV target detection, and why geography has to be real"
description: "Domain randomization taught computer vision that photorealism isn't the goal — robustness is. For a detection model that has to work over actual terrain, geospatial accuracy is the constraint that matters instead, and that's the methodology behind the rendering backend we built for it."
date: 2026-08-28
tags: ["Computer Vision", "Synthetic Data", "UAV", "Simulation", "AI Training"]
placeholder: false
draft: true
---

A UAV target-detection model needs a lot of labeled imagery to be any good, and
getting that imagery the honest way — flying real drones over real terrain and
hand-annotating what comes back — is slow, expensive, and covers a narrow
slice of the conditions the model will actually meet: one season, one set of
airframes, whatever the weather happened to be that week. Synthetic data is
the standard answer to that gap. What's less standard is *which kind* of
synthetic data, because the field has spent a decade arguing about it, and the
answer changes depending on what you're actually trying to detect.

## Two schools of synthetic data

The first instinct is photorealism: render the scene as convincingly as
possible and the model should generalize to real photos the way it would to
another photorealistic render. That instinct turns out to be only half right,
and the paper that made the field notice was Tobin et al.'s 2017 work on
**domain randomization**.[^1] Rather than chasing photorealism, they trained
an object-localization network on simulated images with textures, lighting,
camera position, and even object shape randomized in *non-realistic* ways —
noisy, cartoonish, deliberately far from anything a camera would actually
capture — and the network transferred to real-world images anyway, with no
real training data at all. The logic: a model trained on one narrow,
consistent visual style latches onto superficial cues specific to that style.
A model trained across wildly varied, randomized renders has nothing
consistent to latch onto except the actual object, so it's forced to learn
features that generalize. NVIDIA's follow-up work extended the same idea to
full object detection and found something sharper still — synthetic data
generated without any artistic effort at photorealism, fine-tuned on a modest
amount of real data, outperformed training on real data alone.[^2]

That's a genuinely useful result, and it's also not a universal answer. Domain
randomization is strongest when the task is "recognize this object regardless
of its surroundings" — pick out a mug on a random cluttered desk, a bottle
in an arbitrary bin. A UAV flying a real search-and-rescue or reconnaissance
mission isn't in that regime: it needs to detect a target *in* real terrain,
at real UAV altitude and look-down angle, against real satellite and aerial
imagery style — the surroundings aren't noise to be trained away, they're
the actual mission. Microsoft's AirSim, built on Unreal Engine specifically
for autonomous-vehicle and drone perception work, sits closer to that end of
the spectrum: photoreal rendering, real physics, real protocol support
(MAVLink among them) so the simulated sensor stream looks like the one a real
autopilot would produce.[^3] The question for a UAV detection model flying
real missions isn't domain randomization versus photorealism in the
abstract — it's which axis actually needs to be real for the task at hand.

## Real aerial imagery already exists — so why simulate at all?

It's worth being honest that this problem isn't unaddressed. VisDrone —
collected by the AISKYEYE team, covering over 260,000 video frames and
10,000 static images across 14 Chinese cities with more than 2.6 million
hand-annotated bounding boxes — is a real, substantial, drone-captured
detection and tracking benchmark.[^4] DOTA does the same for wide-area
aerial imagery, close to 1.8 million instances across 18 categories in its
current version.[^5] Both are genuinely useful, and neither solves the
coverage problem: they're fixed collections, shot over specific cities,
specific seasons, specific sensor platforms. A model that only ever sees
VisDrone's cities has no guarantee it generalizes to a different region's
building density, road layout, or vegetation — and there's no way to add a
new geography to either dataset without doing the expensive thing again:
flying a real drone over it.

That's the actual case for synthetic geospatial rendering, and it's narrower
than "synthetic data is cheaper," though it is that too: it's *coverage* a
fixed real-world dataset structurally can't provide. Point a rendering
pipeline at Cesium ion's global terrain and imagery instead of a fixed
capture, and the same detection model can be evaluated — or trained — against
a UAV's actual camera geometry over any real coordinates on Earth, not just
the handful of cities someone already flew.

## What we actually built

That's the reasoning behind the geospatial rendering service in
`swarmpu-worldsim`: a
headless multi-camera rendering backend, not a full training pipeline —
it produces the imagery, it doesn't yet close the loop on training or
evaluation. Three pieces, each doing one job:

- **control-plane** (FastAPI) owns stream and scene lifecycle and exposes the
  REST API: create a stream, give it a camera pose, tear it down.
- **cesiumjs-renderer** (Node.js) is where the actual rendering happens —
  CesiumJS running inside a real, headless Chromium instance via Playwright,
  one browser context per active stream, so N streams render and encode
  concurrently on genuinely independent cameras rather than one shared scene
  time-sliced between them. Up to 20 concurrent streams by default. Frames
  are captured off the browser's own encoder and piped into a per-stream
  `ffmpeg` process.
- **mediaMTX** takes ffmpeg's H.264 output and republishes it over RTSP —
  the actual video transport a downstream detection model or evaluation
  harness would consume from.

Each stream's camera pose is absolute and independent: WGS84 latitude,
longitude, height above the ellipsoid, yaw, pitch, roll, and vertical field
of view, matching how a real UAV gimbal is actually described rather than an
arbitrary game-engine coordinate frame. That's what makes true multi-UAV
simulation possible — a dozen independent cameras anywhere on the globe at
once, not one camera and a fixed set of preset viewpoints.

## Why CesiumJS, and not the game engine everyone else uses

The obvious build for this is a Cesium plugin inside a real game engine —
that's exactly what AirSim does with Unreal, and it's where this project
started too. It didn't stay there. Unreal was tried first and set aside;
a Godot-plus-Cesium-plugin path was tried next and abandoned for a concrete,
verifiable reason: the Cesium GDExtension's asset builder depends on an
editor-only API (`edited_scene_root`), and the globe transform it needs
crashed the moment the whole thing ran headless rather than inside the
Godot editor.[^6] That's not a one-off bug so much as a structural mismatch —
game-engine Cesium integrations are generally built and tested by people
sitting in the editor watching a viewport, and "headless, server-side,
`-RenderOffscreen`, no GPU display attached" is the exact scenario that
integration path least expects.

CesiumJS sidesteps that mismatch by construction rather than by fixing it:
a browser is designed to run headless from day one — that's what CI
screenshot testing and web scraping have relied on for years — so there's no
editor-dependent code path to trip over in the first place. It also means
the *rendering* stays on the same Cesium ion terrain, imagery, and 3D
Tiles ecosystem a Cesium-for-Unreal or Cesium-for-Godot integration would
use; what changed is the host process running it, not the underlying
geospatial data.

## What isn't built yet

None of the above is a training pipeline, and it's worth saying plainly what
would still need to exist for it to become one:

- **No ground-truth export.** The renderer places entities and streams video;
  it does not yet emit bounding boxes, segmentation masks, or any other
  structured label alongside a frame. Labels today would still mean external
  work, not a button in this pipeline.
- **No weather or time-of-day variation.** Lighting is currently whatever a
  fixed simulation clock gives it — real domain-randomization-style variation
  in conditions doesn't exist yet.
- **No closed training/evaluation loop.** Nothing here feeds a detection
  model's predictions back into camera control, and nothing automates
  comparing synthetic-trained performance against real imagery — the actual
  reality-gap question domain randomization research exists to answer stays
  open for this specific pipeline.

That's consistent with what this actually is right now: a real, working
geospatial rendering and streaming backend, not yet the full methodology it's
built to eventually support.

## Where this sits

`swarmpu-worldsim` is a sim-only tool — it doesn't run on the SPU, and it
never will; it's the rendering backend feeding whatever trains or evaluates a
detection model *before* that model ever reaches real hardware. Once it
does, the SPU's own architecture already has the seam for it: a dedicated
link for onboard sensors and companion computers, the same external-payload
pattern the autopilot bridge already uses — see [the SPU](/products/spu).
The model this pipeline helps train is exactly the kind of payload that link
is for.

---

### Sources

[^1]: Tobin, J., Fong, R., Ray, A., Schneider, J., Zaremba, W., & Abbeel, P. (2017). ["Domain Randomization for Transferring Deep Neural Networks from Simulation to the Real World."](https://arxiv.org/abs/1703.06907) *IEEE/RSJ International Conference on Intelligent Robots and Systems (IROS) 2017.*
[^2]: Tremblay, J., Prakash, A., Acuna, D., et al. (2018). ["Training Deep Networks with Synthetic Data: Bridging the Reality Gap by Domain Randomization."](https://arxiv.org/abs/1804.06516) *CVPR 2018 Workshops.* NVIDIA.
[^3]: Shah, S., Dey, D., Lovett, C., & Kapoor, A. (2017). ["AirSim: High-Fidelity Visual and Physical Simulation for Autonomous Vehicles."](https://arxiv.org/abs/1705.05065) *Field and Service Robotics.* Microsoft Research. See also: [microsoft/AirSim on GitHub](https://github.com/microsoft/AirSim).
[^4]: Zhu, P., Wen, L., Du, D., Bian, X., Fan, H., Hu, Q., & Ling, H. (2021). ["Detection and Tracking Meet Drones Challenge."](https://arxiv.org/abs/2001.06303) *IEEE Transactions on Pattern Analysis and Machine Intelligence.* Dataset: [aiskyeye.com](http://www.aiskyeye.com).
[^5]: Xia, G.-S., Bai, X., Ding, J., Zhu, Z., Belongie, S., Luo, J., Datcu, M., Pelillo, M., & Zhang, L. (2018). ["DOTA: A Large-Scale Dataset for Object Detection in Aerial Images."](https://arxiv.org/abs/1711.10398) *CVPR 2018.*
[^6]: From this project's own commit history (`8cc1536`, "checkpoint: abandon Godot+Cesium plugin path before pivoting to CesiumJS renderer") — the Cesium GDExtension's `AssetBuilder` depends on the editor-only `edited_scene_root`, and its globe transform crashed at runtime once the project ran headless.
