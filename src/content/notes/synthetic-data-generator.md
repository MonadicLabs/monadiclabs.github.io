---
title: "Synthetic Data Generator for UAV Target Detection AI Models"
description: "Building a headless geospatial multi-camera rendering service to generate synthetic training data for UAV visual AI - the WitheringSpoon World simulator."
date: 2026-08-22
tags: ["Simulation", "Computer Vision", "Synthetic Data", "UAV", "AI Training"]
placeholder: false
draft: true
---

# Building Synthetic Data Generation for UAV Visual AI Models

## Background: The Data Challenge for Visual AI Models

Visual AI models for UAV target detection, tracking, and recognition rely on large quantities of labeled training data. In real-world scenarios, collecting this data involves:

- **Field work**: Deploying UAVs over real terrain, which is time-consuming, expensive, and limited by weather, operational constraints, and safety considerations
- **Annotation costs**: Manual labeling of UAV imagery requires domain expertise
- **Coverage gaps**: Achieving diverse lighting, weather, and view angles at scale
- **Regulatory hurdles**: Flying over populated or restricted areas can be challenging

These limitations make synthetic data generation an attractive alternative.

## The WitheringSpoon World Solution

WitheringSpoon World is a headless geospatial multi-camera rendering service designed specifically for synthetic data generation, closed-loop simulation, and perception model evaluation. It bridges the gap between traditional game engines (like Unreal) and professional GIS rendering.

### Architecture Overview

The system uses a three-tier architecture:

```
                    ┌─────────────────┐
  HTTP/WS  ────────▶│  control-plane   │  FastAPI, port 8000
  (clients)         │  (Python)        │  stream/scene lifecycle, REST API
                    └────────┬─────────┘
                             │ WebSocket (JSON messages)
                    ┌────────▼─────────┐
                    │ cesiumjs-renderer│  Node.js, ports 8888 (WS) / 8080 (HTTP)
                    │                  │  one headless Chromium context per
                    │  Playwright  +   │  active stream — genuine concurrent
                    │  CesiumJS    +   │  rendering, not time-sliced
                    │  ffmpeg          │
                    └────────┬─────────┘
                             │ H.264 / RTSP, one path per stream
                    ┌────────▼─────────┐
                    │     mediaMTX     │  port 8554
                    └──────────────────┘
                             │
                    consumers (ffplay, OpenCV, GStreamer, ...)
```

### Technical Design

#### 1. Multi-Stream Independent Camera System
Each stream maintains its own absolute camera pose:

| Field | Type | Meaning |
|-------|------|---------|
| `lat` | degrees | WGS84 latitude |
| `lon` | degrees | WGS84 longitude |
| `msl_alt` | meters | Height above WGS84 ellipsoid |
| `yaw` | degrees | Compass bearing clockwise from north |
| `pitch` | degrees | Nose-up positive (-90° = straight down) |
| `roll` | degrees | Bank angle |
| `fov` | degrees | Vertical field of view |

This design allows simulating multiple independent UAVs flying anywhere on the globe simultaneously.

#### 2. High-Fidelity Rendering Backend
The system uses CesiumJS (headless Chromium via Playwright) for realistic geospatial rendering:

- **Cesium ion integration**: Professional terrain, imagery, and 3D buildings
- **Global 3D Tilesets**: Billboard, building, and terrain detail levels
- **One headless Chromium context per stream**: Genuine concurrent rendering
- **Google's Photorealistic 3D Tiles** (optional): Enhanced realism

#### 3. Real-Time Video Streaming Pipeline
Frames are captured via the browser's native JPEG encoder, processed through ffmpeg (GPU-accelerated), and published over RTSP:

```
CesiumJS → ffmpeg (H.264/NVENC/VAAPI) → mediaMTX (RTSP) → OpenCV/Deep Learning frameworks
```

#### 4. API-First Control Plane
FastAPI handles all client interactions:

```python
# Create a UAV stream
curl -X POST http://localhost:8000/api/v1/streams -d '{
  "stream_id": "uav1",
  "camera": {"lat": 48.8584, "lon": 2.2945, "msl_alt": 250, "yaw": 0, "pitch": -30, "roll": 0, "fov": 60}
}'
```

## Implementation Highlights

### 1. Unreal Engine Integration (Historical Context)
Earlier iterations used Unreal Engine and Godot for rendering, building a solid foundation for the current CesiumJS-based system. These provide historical context and demonstrate the evolution of the solution.

### 2. Production-Ready Architecture
- **18 Python tests** pass automatically
- **Dockerized deployment**: Both NVIDIA GPU and CPU-only variants
- **Real-time coordination**: WebSocket-based communication between control plane and renderer
- **Scalable design**: Supports up to 20 concurrent streams by default
- **Hardware-accelerated encoding**: NVIDIA NVENC, Intel VAAPI, software fallback

### 3. Flexible Scene System
- **Global entities**: Vehicles, personnel, infrastructure (same across all streams)
- **Model management**: Drag-and-drop `.glb`/`.gltf` files (no rebuild needed)
- **Precise placement**: Interactive editor with direct coordinate input
- **Version control**: JSON export/import for scene management

### 4. Performance Optimization
- **Adaptive quality**: Stream timeout and resource management
- **Fixed simulation clock**: Deterministic lighting conditions
- **Hardware-specific tuning**: Different settings for NVIDIA vs CPU environments
- **Monitoring integration**: Prometheus/Grafana for real-time metrics

## Synthetic Data Generation Use Cases

### 1. UAV Perception Model Training
- **Object detection**: Vehicles, personnel, infrastructure
- **Pose estimation**: UAV camera trajectories and orientations
- **Semantic segmentation**: Building materials, vegetation, terrain
- **Change detection**: Pre-deployment vs post-deployment scenarios

### 2. Closed-Loop Simulation
- **Model inference**: Real-time processing of synthetic frames
- **Feedback loops**: Model predictions informing camera control
- **Performance evaluation**: Comparing synthetic vs real-world data
- **Domain adaptation**: Training models on synthetic data, testing on real imagery

### 3. Training Scenario Creation
- **Urban environments**: Buildings, streets, landmarks
- **Natural terrain**: Forests, mountains, coastal areas
- **Weather simulation**: Different lighting conditions
- **Multi-sensor scenarios**: RGB, thermal, LiDAR simulation (in development)

## Technical Advantages

### 1. Geospatial Accuracy
- **WGS84 coordinates**: Industry-standard geographic referencing
- **Global coverage**: Anywhere on Earth, independent viewpoints per stream
- **Real-world scale**: 1 unit = 1 meter in models
- **Camera realism**: Matches UAV flight dynamics (nose-down pitch, horizon reference)

### 2. Production Features
- **Hardware passthrough**: `/dev/dri` for GPU access, not `--privileged`
- **Service reliability**: Health checks and stream lifecycle management
- **Scalability**: Independent streams for true multi-UAV simulation
- **Flexibility**: API-driven configuration, no static scene constraints

### 3. Development-Friendly
- **Docker-first**: Consistent deployment across environments
- **API-first**: Programmatic scene and stream management
- **Web editor**: Interactive scene creation and editing
- **Monitoring**: Built-in metrics and health checks

## Usage Examples

### Basic Multi-UAV Simulation
```bash
# Create three UAV streams from different locations
# Stream 1: Urban surveillance
curl -X POST http://localhost:8000/api/v1/streams -d '{
  "stream_id": "uav1",
  "camera": {"lat": 40.7128, "lon": -74.0060, "msl_alt": 300, "yaw": 90, "pitch": -45, "roll": 0, "fov": 60}
}'

# Stream 2: Rural monitoring
curl -X POST http://localhost:8000/api/v1/streams -d '{
  "stream_id": "uav2",
  "camera": {"lat": 51.5074, "lon": -0.1278, "msl_alt": 200, "yaw": 270, "pitch": -30, "roll": 0, "fov": 90}
}'

# Stream 3: Mountain surveillance
curl -X POST http://localhost:8000/api/v1/streams -d '{
  "stream_id": "uav3",
  "camera": {"lat": 35.6762, "lon": 139.6503, "msl_alt": 500, "yaw": 0, "pitch": -60, "roll": 0, "fov": 45}
}'
```

### Synthetic Data Pipeline
```python
# Process synthetic streams for AI model training
for stream in api.get_streams():
    while True:
        frame = capture_frame(stream['stream_id'])
        label = annotate_target(frame)  # Manual or semi-automated
        model.train_on_synthetic(frame, label)
```

## Current Limitations and Future Directions

### Phase 2 Development
1. **Weather and time-of-day simulation**: Realistic lighting conditions
2. **Multi-sensor support**: Thermal, LiDAR, hyperspectral capabilities
3. **Ground truth annotation export**: Structured datasets for training
4. **Military asset spawning**: Dynamic addition of targets and threats

### Phase 3 Vision
1. **Swarm coordination integration**: Realistic UAV collaboration scenarios
2. **Perception model hooks**: Direct integration with detection/tracking frameworks
3. **Performance optimization**: Real-time inference during simulation
4. **Advanced Cesium features**: Enhanced terrain and building detail

## Conclusion

WitheringSpoon World provides a robust foundation for synthetic data generation in UAV perception research. By combining professional geospatial rendering (CesiumJS) with a scalable multi-camera architecture, it enables realistic UAV simulation for training computer vision models.

The system is production-ready, supports diverse use cases, and provides a flexible platform for ongoing development of visual AI capabilities. Its architecture ensures that synthetic data generation can scale alongside the growing demands of UAV perception modeling.

**Key takeaways**:

1. **Realistic rendering**: Professional GIS quality for training data
2. **Independent cameras**: True multi-UAV simulation capability
3. **Production features**: Monitoring, deployment, and reliability built-in
4. **Flexible API**: Programmatic control for automated workflows
5. **Scalable design**: Hardware-agnostic deployment options

This makes WitheringSpoon World a compelling alternative to traditional game engine simulators for synthetic UAV data generation, offering better geospatial accuracy and more realistic visual data for training UAV perception AI models.
