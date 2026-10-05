#!/usr/bin/env python3
"""Backfill historical event bboxes from detect-frame (640x360) coords to snapshot-image coords.

New events are scaled by Python at emit time (frame_pipeline.align_event_bbox) and stamped
with metadata.bboxSpace = "image". Rows written before that fix carry detect-frame coords,
so the frontend's renderedW/naturalW scaling draws them at 1/4 size in the top-left.

Idempotent: any event already stamped with bboxSpace is skipped. Events whose snapshot
file is missing are skipped (retried on a later run).

Runs on the host: needs python3 + PIL, and docker access to the postgres container.

Usage:
    python3 scripts/backfill-bbox-coordinates.py            # dry run (prints counts)
    python3 scripts/backfill-bbox-coordinates.py --apply    # execute
    python3 scripts/backfill-bbox-coordinates.py --apply --limit 50
"""

import argparse
import json
import subprocess
import sys
from pathlib import Path

try:
    from PIL import Image
except ImportError:
    sys.exit("PIL (Pillow) is required: python3 -m pip install --user pillow")

REPO_ROOT = Path(__file__).resolve().parent.parent
PSQL = ["docker", "exec", "-i", "sentryvision-postgres", "psql", "-U", "sentryvision", "-d", "sentryvision"]
DETECT_W, DETECT_H = 640, 360


def psql_text(sql: str) -> str:
    return subprocess.run(
        PSQL + ["-t", "-A", "-c", sql],
        check=True, capture_output=True, text=True,
    ).stdout.strip()


def psql_stdin(sql: str) -> str:
    return subprocess.run(
        PSQL + ["-v", "ON_ERROR_STOP=1"],
        input=sql, check=True, capture_output=True, text=True,
    ).stdout.strip()


def fetch_rows(limit: int | None) -> list[dict]:
    sql = (
        "SELECT coalesce(json_agg(row_to_json(t)), '[]') FROM ("
        "SELECT id, file_path, object_detections, face_detections FROM events"
        " WHERE file_path IS NOT NULL"
        "   AND object_detections IS NOT NULL"
        "   AND (metadata::jsonb ->> 'bboxSpace') IS DISTINCT FROM 'image'"
        " ORDER BY timestamp"
    )
    if limit:
        sql += f" LIMIT {int(limit)}"
    sql += ") t;"
    return json.loads(psql_text(sql))


def host_path(container_path: str) -> Path:
    if container_path.startswith("/app/"):
        return REPO_ROOT / container_path[len("/app/"):]
    p = Path(container_path)
    return p if p.is_absolute() else REPO_ROOT / p


def scale_bbox(bbox: dict, sx: float, sy: float) -> dict | None:
    if not isinstance(bbox, dict):
        return None
    try:
        x = float(bbox["x"])
        y = float(bbox["y"])
        w = float(bbox["width"])
        h = float(bbox["height"])
    except (KeyError, TypeError, ValueError):
        return None
    return {
        "x": round(x * sx, 1),
        "y": round(y * sy, 1),
        "width": round(w * sx, 1),
        "height": round(h * sy, 1),
    }


def scale_detections(dets, sx: float, sy: float):
    """Returns (scaled_list_or_None, changed). None -> input untouched."""
    if not dets:
        return None, False
    changed = False
    out = []
    for d in dets:
        scaled = scale_bbox(d.get("bbox"), sx, sy) if isinstance(d, dict) else None
        if scaled is not None and scaled != d.get("bbox"):
            changed = True
            out.append({**d, "bbox": scaled})
        else:
            out.append(d)
    return (out if changed else None), changed


def sql_literal(value: str) -> str:
    return "'" + value.replace("'", "''") + "'"


def build_sql(rows: list[dict]) -> tuple[str, dict]:
    """Returns (sql, stats). stats: updated / no_scale / missing_file."""
    stats = {"updated": 0, "no_scale": 0, "missing_file": 0, "detections": 0}
    stmts = ["BEGIN;"]

    for row in rows:
        event_id = row["id"]
        path = host_path(row["file_path"])
        try:
            with Image.open(path) as im:
                w, h = im.size
        except FileNotFoundError:
            stats["missing_file"] += 1
            continue
        except Exception as exc:
            print(f"  ! unreadable image for {event_id}: {exc}", file=sys.stderr)
            stats["missing_file"] += 1
            continue

        sx, sy = w / DETECT_W, h / DETECT_H
        obj, obj_changed = scale_detections(row.get("object_detections"), sx, sy)
        face, face_changed = scale_detections(row.get("face_detections"), sx, sy)

        sets = ["metadata = (coalesce(nullif(metadata, ''), '{}')::jsonb || '{\"bboxSpace\":\"image\"}'::jsonb)::text"]
        if obj_changed and obj is not None:
            sets.append("object_detections = " + sql_literal(json.dumps(obj)) + "::jsonb")
        if face_changed and face is not None:
            sets.append("face_detections = " + sql_literal(json.dumps(face)) + "::jsonb")

        if not obj_changed and not face_changed:
            stats["no_scale"] += 1
        else:
            stats["updated"] += 1
            stats["detections"] += sum(1 for d in (obj or []) if isinstance(d, dict))

        stmts.append(f"UPDATE events SET {', '.join(sets)} WHERE id = '{event_id}';")

        if obj_changed or face_changed:
            stmts.append(
                f"UPDATE event_detections SET "
                f"bbox_x = round(bbox_x * {sx:.6f})::int, "
                f"bbox_y = round(bbox_y * {sy:.6f})::int, "
                f"bbox_w = round(bbox_w * {sx:.6f})::int, "
                f"bbox_h = round(bbox_h * {sy:.6f})::int "
                f"WHERE event_id = '{event_id}' AND bbox_x IS NOT NULL;"
            )

    stmts.append("COMMIT;")
    return "\n".join(stmts), stats


def verify_remaining() -> int:
    n = psql_text(
        "SELECT count(*) FROM events WHERE object_detections IS NOT NULL "
        "AND (metadata::jsonb ->> 'bboxSpace') IS DISTINCT FROM 'image';"
    )
    return int(n or 0)


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--apply", action="store_true", help="execute (default: dry run)")
    ap.add_argument("--limit", type=int, default=None, help="only process the oldest N events")
    args = ap.parse_args()

    print(f"remaining unstamped before: {verify_remaining()}")
    rows = fetch_rows(args.limit)
    print(f"rows fetched: {len(rows)} (limit={args.limit})")

    sql, stats = build_sql(rows)
    print(f"  scaled events : {stats['updated']}  ({stats['detections']} detections)")
    print(f"  already 1:1   : {stats['no_scale']}  (image is 640x360, stamp only)")
    print(f"  missing file  : {stats['missing_file']}  (skipped, retried next run)")

    if not args.apply:
        print("\nDRY RUN — pass --apply to execute.")
        return 0

    if stats["updated"] or stats["no_scale"]:
        result = psql_stdin(sql)
        if result:
            print(result)
    print(f"remaining unstamped after : {verify_remaining()}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
