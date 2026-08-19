#!/usr/bin/env python3
"""One-shot cleanup: enforce verified-human-only persistence on legacy events.

Targets events with no human_verifications row (pre-verifier legacy data).

Decision pipeline per event:
1. Crop the person bbox out of the full-res snapshot (scaled from the 640x360
   detection frame, padded) and run the local HumanVerifier with the original
   YOLO score — the same decision the live pipeline makes.
2. Local PASS -> keep, backfill human_verifications.
3. Local FAIL -> arbitrate with the NVIDIA vision service (POST
   /api/nvidia/analyze-event). Calls are deduplicated per (camera, minute)
   bucket, and a bucket reuses the previous bucket's verdict when it lands
   within the chaining window on the same camera (positives 180s, negatives
   60s) so activity bursts collapse into single calls.
   - LLM sees a person -> keep, backfill tier 'llm'
   - LLM sees no person  -> delete event row + image file
   - LLM error           -> leave event untouched (rerunnable)
4. Person event with no image / unreadable file -> delete row (cannot verify).

Non-person events with images: LLM arbitrates too; no-person keeps the row
but nulls file_path and deletes the file.

Usage:
  python cleanup_unverified.py                       plan only, no changes
  python cleanup_unverified.py --apply               perform cleanup
  python cleanup_unverified.py --apply --no-llm      local verifier only
  python cleanup_unverified.py --sample-llm N        dry-run, arbitrate N buckets
"""

import argparse
import json
import os
import sys
import time
import urllib.error
import urllib.request

import cv2
import psycopg2

from person_verifier import HumanVerifier

DB = "sentryvision"
USER = "sentryvision"
PW = "sentryvision123"
PORT = 5432

DETECT_W, DETECT_H = 640, 360
BATCH_WIDTH = 640
PAD_FRAC = 0.2
COMMIT_EVERY = 250
PROGRESS_EVERY = 500
POSITIVE_CHAIN_S = 180
NEGATIVE_CHAIN_S = 60
LLM_TIMEOUT_S = 150


def connect():
    for host in ("localhost", "postgres"):
        try:
            return psycopg2.connect(dbname=DB, user=USER, password=PW, host=host, port=PORT)
        except psycopg2.OperationalError:
            continue
    raise SystemExit("cannot reach postgres on localhost or postgres")


def load_events(cur, limit):
    cur.execute(
        """
        SELECT e.id, e.event_type, e.file_path, e.camera_id, e.confidence,
               e.timestamp, e.object_detections
        FROM events e
        WHERE NOT EXISTS (
            SELECT 1 FROM human_verifications hv WHERE hv.event_id = e.id
        )
        ORDER BY e.timestamp DESC
        LIMIT %s
        """,
        (limit,),
    )
    return cur.fetchall()


def person_bbox(od):
    """Largest person detection from object_detections. Returns (bbox, conf) or None."""
    if not od:
        return None
    best = None
    try:
        for det in od:
            if det.get("class") != "person":
                continue
            bbox = det.get("bbox")
            if not bbox:
                continue
            area = float(bbox.get("width", 0)) * float(bbox.get("height", 0))
            conf = float(det.get("confidence", 0))
            if conf > 1:
                conf /= 100.0
            if best is None or area > best[0]:
                best = (area, bbox, conf)
    except (TypeError, ValueError, AttributeError):
        return None
    if best is None:
        return None
    return best[1], best[2]


def verify_local(verifier, fpath, od, fallback_score):
    """Crop-based HumanVerifier check. Returns (verdict|None, reason)."""
    img = cv2.imread(fpath)
    if img is None:
        return None, "unreadable"
    ih, iw = img.shape[:2]

    picked = person_bbox(od)
    crop = None
    yolo_score = 0.1
    if picked:
        bbox, conf = picked
        yolo_score = conf if conf > 0 else fallback_score
        sx, sy = iw / DETECT_W, ih / DETECT_H
        x, y = float(bbox.get("x", 0)) * sx, float(bbox.get("y", 0)) * sy
        w, h = float(bbox.get("width", 0)) * sx, float(bbox.get("height", 0)) * sy
        px, py = w * PAD_FRAC, h * PAD_FRAC
        x0, y0 = max(0, int(x - px)), max(0, int(y - py))
        x1, y1 = min(iw, int(x + w + px)), min(ih, int(y + h + py))
        if x1 - x0 >= 8 and y1 - y0 >= 8:
            crop = img[y0:y1, x0:x1]

    if crop is None:
        if img.shape[1] > BATCH_WIDTH:
            s = BATCH_WIDTH / img.shape[1]
            crop = cv2.resize(img, (BATCH_WIDTH, max(1, int(img.shape[0] * s))))
        else:
            crop = img
        yolo_score = fallback_score

    return verifier.verify_detailed(crop, yolo_score=yolo_score), None


def llm_person_present(api_base, token, event_id):
    """Ask the NVIDIA analyzer whether a person is visible. True/False/None(error)."""
    req = urllib.request.Request(
        f"{api_base}/api/nvidia/analyze-event",
        data=json.dumps({"eventId": event_id}).encode(),
        headers={"Content-Type": "application/json", "Authorization": f"Bearer {token}"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=LLM_TIMEOUT_S) as resp:
            body = json.loads(resp.read().decode())
    except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError, json.JSONDecodeError):
        return None
    analysis = body.get("analysis") or body.get("result") or {}
    if not body.get("success", True):
        return None
    people = (analysis.get("detectedEntities") or {}).get("people")
    if people is None:
        people = analysis.get("persons")
    if people is None:
        scene = (analysis.get("summary") or analysis.get("sceneDescription") or "").lower()
        return "person" in scene or "people" in scene
    return len(people) > 0


def backfill_verification(cur, eid, camera_id, tier, keypoints=0, face=False,
                          yolo_score=0.0, elapsed_ms=0):
    cur.execute(
        """
        INSERT INTO human_verifications
            (event_id, camera_id, verified, tier, keypoints, face_detected,
             yolo_score, elapsed_ms)
        VALUES (%s, %s, TRUE, %s, %s, %s, %s, %s)
        """,
        (eid, camera_id, tier, keypoints, face, yolo_score, elapsed_ms),
    )


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true", help="perform changes (default: plan only)")
    ap.add_argument("--limit", type=int, default=100000, help="max events to process")
    ap.add_argument("--no-llm", action="store_true", help="skip LLM arbitration (local verifier only)")
    ap.add_argument("--sample-llm", type=int, default=0, help="dry-run: arbitrate first N FAIL buckets")
    ap.add_argument("--api-base", default="http://backend:9753")
    ap.add_argument("--api-token", default=os.environ.get("CLEANUP_API_TOKEN", ""))
    args = ap.parse_args()

    conn = connect()
    cur = conn.cursor()
    verifier = HumanVerifier()

    rows = load_events(cur, args.limit)
    print(f"{len(rows)} unverified events to process (apply={args.apply}, no_llm={args.no_llm})", flush=True)

    stats = {
        "local_keep": 0,
        "llm_keep": 0,
        "llm_delete": 0,
        "llm_error_keep": 0,
        "no_image_delete": 0,
        "image_strip": 0,
        "errors": 0,
    }
    files_to_delete = []
    llm_calls = 0
    t0 = time.time()

    # bucket -> (representative event index, [event indexes])
    buckets = {}
    decisions = {}

    for i, (eid, etype, fpath, camera_id, conf, ts, od) in enumerate(rows):
        try:
            if not fpath:
                if etype == "person":
                    stats["no_image_delete"] += 1
                    decisions[i] = ("delete", None)
                else:
                    decisions[i] = ("keep", None)
                continue

            if not os.path.exists(fpath):
                if etype == "person":
                    stats["no_image_delete"] += 1
                    decisions[i] = ("delete", None)
                else:
                    stats["image_strip"] += 1
                    decisions[i] = ("strip_image", fpath)
                continue

            verdict, err = verify_local(verifier, fpath, od, float(conf or 0))
            if err:
                if etype == "person":
                    stats["no_image_delete"] += 1
                    decisions[i] = ("delete", None)
                else:
                    stats["image_strip"] += 1
                    decisions[i] = ("strip_image", fpath)
                continue

            if verdict["verified"]:
                stats["local_keep"] += 1
                decisions[i] = (
                    "keep",
                    ("local", verdict["tier"], verdict.get("keypoints", 0),
                     verdict.get("face_detected", False), verdict.get("yolo_score", 0),
                     verdict.get("elapsed_ms", 0)),
                )
            else:
                if args.no_llm:
                    decisions[i] = ("unverified_skip", None)
                    continue
                bucket_key = (camera_id, ts.strftime("%Y-%m-%dT%H:%M"))
                entry = buckets.setdefault(bucket_key, [None, []])
                entry[1].append(i)
                if entry[0] is None or (rows[entry[0]][4] or 0) < (conf or 0):
                    entry[0] = i
        except Exception as exc:  # noqa: BLE001
            stats["errors"] += 1
            print(f"ERROR event {eid}: {exc}", flush=True)
        rows[i] = (eid, etype, fpath, camera_id, conf, ts, None)

        if (i + 1) % PROGRESS_EVERY == 0:
            rate = (i + 1) / max(1e-9, time.time() - t0)
            print(f"  local {i+1}/{len(rows)} rate={rate:.1f}/s stats={stats}", flush=True)

    print(f"local phase done in {(time.time()-t0)/60:.1f} min: {stats}", flush=True)
    print(f"LLM arbitration buckets: {len(buckets)}", flush=True)

    if buckets and not args.no_llm and (args.apply or args.sample_llm > 0):
        need_token = args.api_token
        last_verdict = {}
        sample_left = args.sample_llm
        t1 = time.time()
        for n, (key, (rep_idx, members)) in enumerate(
            sorted(buckets.items(), key=lambda kv: rows[kv[1][0]][5], reverse=True), 1
        ):
            camera_id, _ = key
            rep_ts = rows[rep_idx][5]
            chained = False
            if camera_id in last_verdict:
                prev_ts, prev_present = last_verdict[camera_id]
                gap = (prev_ts - rep_ts).total_seconds()
                window = POSITIVE_CHAIN_S if prev_present else NEGATIVE_CHAIN_S
                if 0 <= gap <= window:
                    present = prev_present
                    chained = True
            if not chained:
                if args.sample_llm and sample_left <= 0:
                    for m in members:
                        decisions[m] = ("unverified_skip", None)
                    continue
                present = llm_person_present(args.api_base, need_token, rows[rep_idx][0])
                llm_calls += 1
                if args.sample_llm:
                    sample_left -= 1
                if present is None:
                    stats["llm_error_keep"] += 1
                    for m in members:
                        decisions[m] = ("unverified_skip", None)
                    continue
            last_verdict[camera_id] = (rep_ts, present)

            if present:
                stats["llm_keep"] += len(members)
                for m in members:
                    decisions[m] = ("keep", ("llm", "llm", 0, False, 0, 0))
            else:
                stats["llm_delete"] += len(members)
                for m in members:
                    fpath = rows[m][2]
                    decisions[m] = ("delete", fpath)
                    if fpath:
                        files_to_delete.append(fpath)
            if n % 25 == 0:
                rate = n / max(1e-9, time.time() - t1)
                eta = (len(buckets) - n) / max(1e-9, rate) / 60
                print(f"  llm {n}/{len(buckets)} calls={llm_calls} rate={rate*60:.0f}/min eta={eta:.0f}m stats={stats}", flush=True)

    if not args.apply:
        print(f"\nDRY-RUN summary (llm_calls={llm_calls}): {stats}", flush=True)
        print(f"files that would be deleted: {len(files_to_delete)}", flush=True)
        return

    applied = 0
    for i, (eid, etype, fpath, camera_id, conf, ts, od) in enumerate(rows):
        action = decisions.get(i, ("unverified_skip", None))[0]
        detail = decisions.get(i, (None, None))[1]
        try:
            if action == "delete":
                cur.execute("DELETE FROM events WHERE id = %s", (eid,))
            elif action == "strip_image":
                cur.execute("UPDATE events SET file_path = NULL WHERE id = %s", (eid,))
            elif action == "keep" and detail:
                _, tier, kp, face, score, elapsed = detail
                backfill_verification(cur, eid, camera_id, tier, kp, face, score, elapsed)
            applied += 1
            if applied % COMMIT_EVERY == 0:
                conn.commit()
        except Exception as exc:  # noqa: BLE001
            stats["errors"] += 1
            print(f"APPLY ERROR event {eid}: {exc}", flush=True)
    conn.commit()

    deleted_files = 0
    for fpath in files_to_delete:
        try:
            os.remove(fpath)
            deleted_files += 1
        except OSError:
            pass

    print(f"\nDone in {(time.time()-t0)/60:.1f} min", flush=True)
    for key, val in stats.items():
        print(f"  {key}: {val}")
    print(f"  llm_calls: {llm_calls}")
    print(f"  files_deleted: {deleted_files}", flush=True)


if __name__ == "__main__":
    sys.exit(main())
