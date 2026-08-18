import cv2
import numpy as np
import sys
import os

sys.path.append('/app')
from person_verifier import HumanVerifier

def test():
    print("Initializing Verifier...")
    v = HumanVerifier()
    # Create a dummy image
    img = np.zeros((300, 300, 3), dtype=np.uint8)
    print("Testing verification...")
    # ROI
    roi = img[0:300, 0:300]
    result = v.verify(roi, 0.5)
    print(f"Verification result: {result}")

if __name__ == "__main__":
    test()
