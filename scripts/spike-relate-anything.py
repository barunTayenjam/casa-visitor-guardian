import argparse
import json
import time

import cv2
import numpy as np
from PIL import Image

DEFAULT_VOCABULARY = [
    "next to",
    "near",
    "behind",
    "in front of",
    "carrying",
    "looking at",
    "interacting with",
    "walking toward",
    "walking away from",
    "holding",
]


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--image", required=True)
    parser.add_argument("--detections", required=True, help="JSON file with object_detections array")
    parser.add_argument("--device", default="cpu")
    parser.add_argument("--model", default="maelic/relsgg-vits16plus")
    parser.add_argument("--debug-out", default="/tmp/relsgg_debug_boxes.jpg")
    parser.add_argument("--topk", type=int, default=3)
    args = parser.parse_args()

    with open(args.detections) as f:
        dets = json.load(f)

    pil = Image.open(args.image).convert("RGB")
    width, height = pil.size

    boxes, labels = [], []
    for d in dets:
        b = d["bbox"]
        x1 = float(np.clip(b["x"], 0, width - 1))
        y1 = float(np.clip(b["y"], 0, height - 1))
        x2 = float(np.clip(b["x"] + b["width"], x1 + 1, width))
        y2 = float(np.clip(b["y"] + b["height"], y1 + 1, height))
        boxes.append([x1, y1, x2, y2])
        labels.append(d.get("class", "object"))

    debug = cv2.cvtColor(np.array(pil), cv2.COLOR_RGB2BGR)
    for (x1, y1, x2, y2), label in zip(boxes, labels):
        cv2.rectangle(debug, (int(x1), int(y1)), (int(x2), int(y2)), (0, 255, 0), 3)
        cv2.putText(debug, label, (int(x1), max(24, int(y1) - 10)), cv2.FONT_HERSHEY_SIMPLEX, 1.2, (0, 255, 0), 3)
    cv2.imwrite(args.debug_out, debug)
    print(f"image: {args.image} ({width}x{height})")
    print(f"boxes: {list(zip(labels, [[round(v, 1) for v in b] for b in boxes]))}")
    print(f"box sanity render -> {args.debug_out}")

    from relsgg import RelateAnything

    t0 = time.time()
    model = RelateAnything.from_pretrained(args.model, device=args.device)
    print(f"model '{args.model}' loaded in {time.time() - t0:.1f}s")

    model.set_vocabulary(DEFAULT_VOCABULARY)

    t0 = time.time()
    triplets = list(model.predict(pil, np.array(boxes, dtype=np.float32), box_labels=labels, topk=args.topk))
    elapsed = time.time() - t0

    print(f"relations ({len(triplets)} triplets, {elapsed * 1000:.0f}ms on {args.device}):")
    for t in triplets:
        print(f"  {t}")


if __name__ == "__main__":
    main()
