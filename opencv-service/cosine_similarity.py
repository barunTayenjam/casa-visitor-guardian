#!/usr/bin/env python3
"""
Cosine Similarity Implementation for Face Recognition
"""

import numpy as np
from typing import List, Tuple, Optional

def cosine_similarity(a: np.ndarray, b: np.ndarray) -> float:
    """
    Calculate cosine similarity between two vectors

    Args:
        a: First vector
        b: Second vector

    Returns:
        Similarity score between 0 and 1
        (1 = identical, 0 = orthogonal, -1 = opposite)
    """
    try:
        # Ensure numpy arrays
        a = np.array(a)
        b = np.array(b)

        # Calculate dot product
        dot_product = np.dot(a, b)

        # Calculate magnitudes
        norm_a = np.linalg.norm(a)
        norm_b = np.linalg.norm(b)

        # Avoid division by zero
        if norm_a == 0 or norm_b == 0:
            return 0.0

        # Calculate cosine similarity
        similarity = dot_product / (norm_a * norm_b)

        # Clamp to [-1, 1] range to handle floating point errors
        similarity = max(-1.0, min(1.0, similarity))

        return float(similarity)

    except Exception as e:
        print(f"Cosine similarity calculation error: {e}")
        return 0.0

def batch_cosine_similarity(
    query_vector: np.ndarray,
    candidate_vectors: List[np.ndarray]
) -> List[Tuple[int, float]]:
    """
    Calculate cosine similarity between query and multiple candidates

    Args:
        query_vector: Query embedding
        candidate_vectors: List of candidate embeddings

    Returns:
        List of (index, similarity_score) tuples sorted by similarity
    """
    similarities = []

    for i, candidate in enumerate(candidate_vectors):
        similarity = cosine_similarity(query_vector, candidate)
        similarities.append((i, similarity))

    # Sort by similarity (descending)
    similarities.sort(key=lambda x: x[1], reverse=True)

    return similarities

def find_best_match(
    query_embedding: np.ndarray,
    known_embeddings: List[np.ndarray],
    threshold: float = 0.6
) -> Tuple[Optional[int], Optional[float], bool]:
    """
    Find best matching embedding using cosine similarity

    Args:
        query_embedding: Query face embedding
        known_embeddings: List of known face embeddings
        threshold: Minimum similarity threshold (0-1)

    Returns:
        Tuple of (best_match_index, similarity_score, is_match_found)
    """
    if not known_embeddings:
        return None, None, False

    # Calculate similarities
    similarities = batch_cosine_similarity(query_embedding, known_embeddings)

    if not similarities:
        return None, None, False

    # Get best match
    best_index, best_similarity = similarities[0]

    # Check if above threshold
    is_match = best_similarity >= threshold

    return best_index, best_similarity, is_match

def euclidean_distance(a: np.ndarray, b: np.ndarray) -> float:
    """
    Calculate Euclidean distance between two vectors (fallback method)

    Args:
        a: First vector
        b: Second vector

    Returns:
        Distance score (0 = identical, higher = more different)
    """
    try:
        a = np.array(a)
        b = np.array(b)
        distance = np.linalg.norm(a - b)
        return float(distance)
    except Exception as e:
        print(f"Euclidean distance calculation error: {e}")
        return float('inf')

def similarity_to_confidence(similarity: float) -> float:
    """
    Convert similarity score to confidence percentage (0-100)

    Args:
        similarity: Cosine similarity (0-1)

    Returns:
        Confidence percentage (0-100)
    """
    # Scale similarity to confidence
    # Similarity of 0.6 = 60% confidence (at threshold)
    # Similarity of 1.0 = 100% confidence
    confidence = max(0, min(100, similarity * 100))

    return round(confidence, 2)
