#!/usr/bin/env python3
"""Populate face_clusters + face_embeddings tables from face_clustering.json.

Saves representative face crops to /app/data/face_crops/ for People page display.
Run inside opencv container:
    docker exec sentryvision-opencv python3 populate_face_clusters.py
"""

import json
import os
import sys

import cv2
import numpy as np
import psycopg2

sys.path.insert(0, '/app')

CLUSTERING_JSON = '/app/face_clustering.json'
FACE_CROPS_DIR = '/app/data/face_crops'

def main():
    if not os.path.exists(CLUSTERING_JSON):
        print(f'No clustering results at {CLUSTERING_JSON} — run clustering first')
        sys.exit(1)

    with open(CLUSTERING_JSON) as f:
        data = json.load(f)

    os.makedirs(FACE_CROPS_DIR, exist_ok=True)

    conn = psycopg2.connect(
        host=os.environ.get('POSTGRES_HOST', 'postgres'),
        port=int(os.environ.get('POSTGRES_PORT', '5432')),
        database=os.environ.get('POSTGRES_DB', 'sentryvision'),
        user=os.environ.get('POSTGRES_USER', 'sentryvision'),
        password=os.environ.get('POSTGRES_PASSWORD'),
    )
    cur = conn.cursor()

    # Clear previous auto-clustered rows (label NULL = auto, keep user-labeled)
    cur.execute("DELETE FROM face_clusters WHERE name IS NULL OR name = ''")
    cur.execute("UPDATE face_embeddings SET cluster_label = NULL WHERE cluster_label LIKE 'person_%'")

    clusters = data['clusters']
    inserted_clusters = 0
    inserted_embeddings = 0
    saved_crops = 0

    for cluster in clusters:
        size = cluster['size']
        person_id = cluster['person_id']
        images = cluster['images']

        # Representative image: first entry
        rep = images[0]
        rep_path = rep['path']

        # Save representative face crop
        rep_crop_path = None
        try:
            image = cv2.imread(rep_path)
            if image is not None:
                x, y, w, h = rep['bbox']
                face_roi = image[y:y+h, x:x+w]
                if face_roi.size > 0:
                    crop_fname = f'{person_id}_rep.jpg'
                    rep_crop_path = os.path.join(FACE_CROPS_DIR, crop_fname)
                    cv2.imwrite(rep_crop_path, face_roi)
                    saved_crops += 1
        except Exception as e:
            print(f'  Crop save failed for {person_id}: {e}')

        # Insert cluster row
        cur.execute(
            """
            INSERT INTO face_clusters (cluster_id, name, image_path, embedding_quality, face_count, description)
            VALUES (%s, %s, %s, %s, %s, %s)
            ON CONFLICT DO NOTHING
            """,
            (person_id, None, rep_crop_path, None, size,
             f'{size} appearance{"s" if size > 1 else ""}')
        )
        inserted_clusters += 1

        # Insert embeddings for each face in this cluster
        for img_meta in images:
            cur.execute(
                """
                INSERT INTO face_embeddings (visitor_id, embedding_vector, quality_score,
                    camera_id, image_path, detection_method, cluster_label)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
                """,
                ('00000000-0000-0000-0000-000000000000', [0.0] * 128, 0.0,
                 img_meta['image'].split('_')[1] if '_' in img_meta['image'] else 'unknown',
                 img_meta['path'], 'arcface_cluster', person_id)
            )
            inserted_embeddings += 1

    conn.commit()

    # Fix face_clusters.cluster_id unique constraint issues
    # by checking count
    cur.execute("SELECT COUNT(*) FROM face_clusters WHERE name IS NULL OR name = ''")
    db_count = cur.fetchone()[0]

    print(f'\nResults:')
    print(f'  Clusters inserted: {inserted_clusters}')
    print(f'  Embeddings inserted: {inserted_embeddings}')
    print(f'  Face crops saved: {saved_crops}')
    print(f'  DB auto-clusters: {db_count}')

    cur.close()
    conn.close()


if __name__ == '__main__':
    main()
