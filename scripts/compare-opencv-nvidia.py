#!/usr/bin/env python3
"""
Compare OpenCV YOLO detection vs NVIDIA Vision LLM on the same image.

Usage:
  python scripts/compare-opencv-nvidia.py <image_path>

Requires: requests, numpy (available in opencv container)
"""

import sys
import os
import json
import time
import argparse
from pathlib import Path


def call_opencv(image_path: str) -> dict:
    import requests as req
    opencv_url = "http://localhost:8084"

    with open(image_path, "rb") as f:
        files = {"image": f}
        t0 = time.time()
        r = req.post(f"{opencv_url}/detect-objects", files=files, timeout=60)
        t1 = time.time()
    result = r.json()
    result["opencv_processing_ms"] = round((t1 - t0) * 1000, 1)
    return result


def call_opencv_analyze(image_path: str) -> dict:
    import requests as req
    opencv_url = "http://localhost:8084"

    with open(image_path, "rb") as f:
        files = {"image": f}
        t0 = time.time()
        r = req.post(f"{opencv_url}/analyze-scene", files=files, timeout=60)
        t1 = time.time()
    result = r.json()
    result["opencv_scene_ms"] = round((t1 - t0) * 1000, 1)
    return result


def call_opencv_threat(image_path: str) -> dict:
    import requests as req
    opencv_url = "http://localhost:8084"

    with open(image_path, "rb") as f:
        files = {"image": f}
        t0 = time.time()
        r = req.post(f"{opencv_url}/analyze-threat", files=files, timeout=60)
        t1 = time.time()
    result = r.json()
    result["opencv_threat_ms"] = round((t1 - t0) * 1000, 1)
    return result


def call_nvidia(image_path: str) -> dict:
    import requests as req
    nvidia_url = "http://localhost:9753/api/nvidia/analyze"

    with open(image_path, "rb") as f:
        files = {"image": f}
        t0 = time.time()
        r = req.post(nvidia_url, files=files, timeout=120)
        t1 = time.time()
    result = r.json()
    result["nvidia_processing_ms"] = round((t1 - t0) * 1000, 1)
    return result


def print_comparison(image_path: str, opencv: dict, scene: dict, threat: dict, nvidia: dict):
    print("=" * 72)
    print(f"  OpenCV vs NVIDIA Comparison")
    print(f"  Image: {image_path}")
    print("=" * 72)

    # ─── Speed ───
    print(f"\n{'─'*35} Speed {'─'*35}")
    print(f"  {'Metric':<35} {'OpenCV':<20} {'NVIDIA':<20}")
    print(f"  {'─'*35} {'─'*20} {'─'*20}")
    nv_ms = nvidia.get("nvidia_processing_ms", 0)
    oc_ms = opencv.get("opencv_processing_ms", 0)
    print(f"  {'Processing time (ms)':<35} {oc_ms:<20} {nv_ms:<20}")

    # ─── Detected Objects ───
    print(f"\n{'─'*35} Objects Detected {'─'*35}")
    oc_objects = {}
    for d in opencv.get("detections", []):
        cls = d.get("class", "unknown")
        oc_objects.setdefault(cls, 0)
        oc_objects[cls] += 1

    nv_entities = nvidia.get("detectedEntities", {})
    nv_people = nv_entities.get("people", [])
    nv_vehicles = nv_entities.get("vehicles", [])
    nv_animals = nv_entities.get("animals", [])
    nv_objects = nv_entities.get("objects", [])

    print(f"  {'Category':<25} {'OpenCV':<20} {'NVIDIA':<20}")
    print(f"  {'─'*25} {'─'*20} {'─'*20}")
    print(f"  {'People':<25} {oc_objects.get('person', 0):<20} {len(nv_people):<20}")
    print(f"  {'Vehicles':<25} {oc_objects.get('car',0)+oc_objects.get('truck',0)+oc_objects.get('bus',0):<20} {len(nv_vehicles):<20}")
    print(f"  {'Animals':<25} {sum(v for k,v in oc_objects.items() if k in ('dog','cat','bird','horse','cow')):<20} {len(nv_animals):<20}")

    oc_other = {k: v for k, v in oc_objects.items() if k not in ('person', 'car', 'truck', 'bus', 'dog', 'cat', 'bird', 'horse', 'cow')}
    print(f"  {'Other objects':<25} {sum(oc_other.values()):<20} {len(nv_objects):<20}")

    print(f"\n  OpenCV detections:")
    for k, v in sorted(oc_objects.items(), key=lambda x: -x[1]):
        print(f"    {k}: {v}")
    print(f"\n  NVIDIA detections:")
    for cat, items in [("People", nv_people), ("Vehicles", nv_vehicles), ("Animals", nv_animals), ("Objects", nv_objects)]:
        if items:
            print(f"    {cat}: {', '.join(items)}")

    # ─── Person Comparison ───
    print(f"\n{'─'*35} Person Detection Detail {'─'*35}")
    persons = [d for d in opencv.get("detections", []) if d.get("class") == "person"]
    if persons:
        for i, p in enumerate(persons):
            print(f"  Person {i+1}: confidence={p['confidence']}% bbox={p['bbox']}")
    else:
        print(f"  OpenCV: No persons detected")
    print(f"  NVIDIA: {len(nv_people)} persons mentioned")

    # ─── Scene Context ───
    print(f"\n{'─'*35} Scene Context {'─'*35}")
    oc_scene = scene.get("scene_context", {})
    nv_scene = nvidia.get("sceneContext", {})
    print(f"  {'Attribute':<25} {'OpenCV':<20} {'NVIDIA':<20}")
    print(f"  {'─'*25} {'─'*20} {'─'*20}")
    for attr in ("environment", "lighting", "timeOfDay", "weather"):
        print(f"  {attr:<25} {oc_scene.get(attr, 'N/A'):<20} {nv_scene.get(attr, 'N/A'):<20}")

    # ─── Scene Description ───
    oc_actions = scene.get("person_actions", [])
    oc_complexity = scene.get("scene_complexity", {})
    print(f"\n  OpenCV scene: {oc_actions}")
    print(f"  OpenCV complexity: {oc_complexity}")
    print(f"  NVIDIA scene desc: {nvidia.get('sceneDescription', 'N/A')[:200]}")

    # ─── Threat Assessment ───
    print(f"\n{'─'*35} Threat Assessment {'─'*35}")
    oc_threat = threat.get("threat_assessment", {})
    nv_threat = nvidia.get("threatAssessment", {})
    print(f"  {'Metric':<25} {'OpenCV':<20} {'NVIDIA':<20}")
    print(f"  {'─'*25} {'─'*20} {'─'*20}")
    print(f"  {'Level':<25} {oc_threat.get('level', 'N/A'):<20} {nv_threat.get('level', 'N/A'):<20}")
    print(f"  {'Confidence':<25} {oc_threat.get('confidence', 0):<20} {nv_threat.get('confidence', 0):<20}")
    print(f"  {'Factors':<25} {len(oc_threat.get('factors', [])):<20} {len(nv_threat.get('factors', [])):<20}")
    if oc_threat.get("factors"):
        print(f"  OpenCV factors: {oc_threat['factors'][:5]}")
    if nv_threat.get("factors"):
        print(f"  NVIDIA factors: {nv_threat['factors'][:5]}")

    # ─── Match Score ───
    print(f"\n{'─'*35} Match Assessment {'─'*35}")
    opencv_found_person = len(persons) > 0
    nvidia_found_person = len(nv_people) > 0
    person_match = "✅ MATCH" if opencv_found_person == nvidia_found_person else "❌ MISMATCH"
    print(f"  Person detection: OpenCV={'yes' if opencv_found_person else 'no'} vs NVIDIA={'yes' if nvidia_found_person else 'no'} → {person_match}")

    threat_match = "✅ MATCH" if oc_threat.get("level") == nv_threat.get("level") else "❌ MISMATCH"
    print(f"  Threat level: OpenCV={oc_threat.get('level','N/A')} vs NVIDIA={nv_threat.get('level','N/A')} → {threat_match}")

    speed_ratio = nv_ms / max(oc_ms, 1)
    print(f"  Speed ratio: NVIDIA is {speed_ratio:.0f}x slower than OpenCV")
    print(f"  OpenCV total: {oc_ms + scene.get('opencv_scene_ms', 0) + threat.get('opencv_threat_ms', 0):.0f}ms")
    print(f"  NVIDIA total: {nv_ms:.0f}ms")
    print("=" * 72)

    summary = {
        "image": image_path,
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%S"),
        "opencv": {
            "detections": opencv.get("detections", []),
            "scene": scene.get("scene_context", {}),
            "threat": oc_threat,
            "processing_ms": oc_ms,
        },
        "nvidia": {
            "scene_description": nvidia.get("sceneDescription", ""),
            "scene_context": nv_scene,
            "threat": nv_threat,
            "entities": nv_entities,
            "processing_ms": nv_ms,
        },
        "match": {
            "person_detection_match": person_match == "✅ MATCH",
            "threat_level_match": threat_match == "✅ MATCH",
            "speed_ratio_nvidia_to_opencv": round(speed_ratio, 1),
        },
    }
    return summary


def main():
    parser = argparse.ArgumentParser(description="Compare OpenCV vs NVIDIA detection")
    parser.add_argument("image", help="Path to image file")
    parser.add_argument("--output", "-o", help="Save results to JSON file")
    parser.add_argument("--skip-nvidia", action="store_true", help="Skip NVIDIA API call (OpenCV only)")
    args = parser.parse_args()

    if not os.path.exists(args.image):
        print(f"Error: Image not found: {args.image}")
        sys.exit(1)

    print(f"\nRunning detection on: {args.image}\n")

    # 1. OpenCV detect-objects
    print("[1/4] OpenCV detect-objects...")
    opencv = call_opencv(args.image)
    print(f"       → {len(opencv.get('detections', []))} objects in {opencv.get('opencv_processing_ms', 0)}ms")

    # 2. OpenCV analyze-scene
    print("[2/4] OpenCV analyze-scene...")
    scene = call_opencv_analyze(args.image)
    print(f"       → done in {scene.get('opencv_scene_ms', 0)}ms")

    # 3. OpenCV analyze-threat
    print("[3/4] OpenCV analyze-threat...")
    threat = call_opencv_threat(args.image)
    print(f"       → level={threat.get('threat_assessment', {}).get('level', 'N/A')} in {threat.get('opencv_threat_ms', 0)}ms")

    # 4. NVIDIA
    if args.skip_nvidia:
        nvidia = {
            "nvidia_processing_ms": 0,
            "sceneContext": {},
            "threatAssessment": {},
            "detectedEntities": {"people": [], "vehicles": [], "animals": [], "objects": []},
            "sceneDescription": "(skipped)",
        }
        print("[4/4] NVIDIA: skipped (--skip-nvidia)")
    else:
        print("[4/4] NVIDIA Vision API (may take 30-60s)...")
        try:
            nvidia = call_nvidia(args.image)
            print(f"       → done in {nvidia.get('nvidia_processing_ms', 0)}ms")
        except Exception as e:
            print(f"       → FAILED: {e}")
            nvidia = {
                "nvidia_processing_ms": 0,
                "sceneContext": {},
                "threatAssessment": {},
                "detectedEntities": {"people": [], "vehicles": [], "animals": [], "objects": []},
                "sceneDescription": f"API error: {e}",
            }

    summary = print_comparison(args.image, opencv, scene, threat, nvidia)

    if args.output:
        with open(args.output, "w") as f:
            json.dump(summary, f, indent=2)
        print(f"\nResults saved to: {args.output}")

    return 0


if __name__ == "__main__":
    main()
