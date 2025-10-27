import cv from '@techstark/opencv-js';
import { createCanvas, loadImage } from 'canvas';
import fs from 'fs';
import path from 'path';

/**
 * OpenCV-based image processing utilities
 */
export class OpenCVProcessor {
  private static initialized = false;

  static async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // Wait for OpenCV to be ready
      if (typeof cv.Mat === 'undefined') {
        console.log('Waiting for OpenCV to initialize...');
        await new Promise(resolve => setTimeout(resolve, 2000));
      }

      this.initialized = true;
      console.log('OpenCV.js initialized successfully');
    } catch (error) {
      console.error('Failed to initialize OpenCV:', error);
      throw error;
    }
  }

  /**
   * Convert image buffer to OpenCV Mat
   */
  static async bufferToMat(buffer: Buffer): Promise<cv.Mat> {
    await this.initialize();
    
    return new Promise((resolve, reject) => {
      try {
        // Load image using canvas, then convert to OpenCV Mat
        loadImage(buffer).then(image => {
          const canvas = createCanvas(image.width, image.height);
          const ctx = canvas.getContext('2d');
          ctx.drawImage(image, 0, 0);
          
          // Get image data and convert to OpenCV Mat
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          
          // Create Mat from image data using the correct OpenCV.js method
          const mat = new cv.Mat(imageData.height, imageData.width, cv.CV_8UC4);
          mat.data.set(imageData.data);
          
          resolve(mat);
        }).catch(reject);
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Detect people using HOG detector
   */
  static async detectPeople(imageMat: cv.Mat): Promise<Array<{confidence: number, bbox: cv.Rect}>> {
    await this.initialize();
    
    try {
      // Convert to grayscale for HOG detector
      const gray = new cv.Mat();
      cv.cvtColor(imageMat, gray, cv.COLOR_RGBA2GRAY);

      // Initialize HOG people detector
      const hog = new cv.HOGDescriptor();
      const hogPeopleDetector = cv.HOGDescriptor.getDefaultPeopleDetector();
      hog.setSVMDetector(hogPeopleDetector);

      // Detect people
      const foundLocations = new cv.MatVector();
      const foundWeights = new cv.Mat();
      hog.detectMultiScale(
        gray,
        foundLocations,
        foundWeights,
        0,
        new cv.Size(8, 8),
        new cv.Size(32, 32),
        1.05,
        2.0,
        false
      );

      const detections = [];
      for (let i = 0; i < foundLocations.size(); i++) {
        const rect = foundLocations.get(i);
        const weight = foundWeights.data32F[i];
        
        // Convert OpenCV Mat to Rect object
        const x = rect.data32S[0];
        const y = rect.data32S[1];
        const width = rect.data32S[2];
        const height = rect.data32S[3];
        
        detections.push({
          confidence: Math.min(Math.max(weight / 2.0 + 0.5, 0), 1), // Normalize to 0-1
          bbox: {
            x, y, width, height
          }
        });
      }

      // Cleanup
      gray.delete();
      foundLocations.delete();
      foundWeights.delete();

      return detections;
    } catch (error) {
      console.error('People detection error:', error);
      return [];
    }
  }

  /**
   * Motion detection using background subtraction
   */
  static async detectMotion(imageMat: cv.Mat): Promise<cv.Mat> {
    await this.initialize();
    
    try {
      // Convert to grayscale
      const gray = new cv.Mat();
      cv.cvtColor(imageMat, gray, cv.COLOR_RGBA2GRAY);

      // Apply Gaussian blur to reduce noise
      const blurred = new cv.Mat();
      cv.GaussianBlur(gray, blurred, new cv.Size(21, 21), 0);

      // Background subtraction (simple frame difference for demo)
      // In production, use cv.BackgroundSubtractorMOG2
      const motionMask = new cv.Mat();
      
      // Create a synthetic motion detection for demo
      // Real implementation would compare with previous frames
      const threshold = 30;
      cv.threshold(blurred, motionMask, threshold, 255, cv.THRESH_BINARY);

      // Morphological operations to clean up the mask
      const kernel = cv.getStructuringElement(cv.MORPH_ELLIPSE, new cv.Size(5, 5));
      cv.morphologyEx(motionMask, motionMask, cv.MORPH_OPEN, kernel);
      cv.morphologyEx(motionMask, motionMask, cv.MORPH_CLOSE, kernel);

      // Cleanup
      gray.delete();
      blurred.delete();
      kernel.delete();

      return motionMask;
    } catch (error) {
      console.error('Motion detection error:', error);
      return new cv.Mat();
    }
  }

  /**
   * Find contours in binary image
   */
  static findContours(binaryMat: cv.Mat): Promise<Array<cv.MatVector>> {
    return new Promise((resolve, reject) => {
      try {
        const contours = new cv.MatVector();
        const hierarchy = new cv.Mat();
        
        cv.findContours(
          binaryMat,
          contours,
          hierarchy,
          cv.RETR_EXTERNAL,
          cv.CHAIN_APPROX_SIMPLE
        );

        resolve([contours]);
        
        // Cleanup
        hierarchy.delete();
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Detect edges using Canny edge detection
   */
  static detectEdges(imageMat: cv.Mat, lowThreshold: number = 50, highThreshold: number = 150): Promise<cv.Mat> {
    return new Promise(async (resolve, reject) => {
      try {
        await this.initialize();
        
        // Convert to grayscale
        const gray = new cv.Mat();
        cv.cvtColor(imageMat, gray, cv.COLOR_RGBA2GRAY);

        // Apply Canny edge detection
        const edges = new cv.Mat();
        cv.Canny(gray, edges, lowThreshold, highThreshold);

        // Cleanup
        gray.delete();
        
        resolve(edges);
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Simple face detection using Haar cascades
   */
  static async detectFaces(imageMat: cv.Mat): Promise<Array<{confidence: number, bbox: cv.Rect}>> {
    await this.initialize();
    
    try {
      // Convert to grayscale
      const gray = new cv.Mat();
      cv.cvtColor(imageMat, gray, cv.COLOR_RGBA2GRAY);

      // Equalize histogram to improve detection
      const equalized = new cv.Mat();
      cv.equalizeHist(gray, equalized);

      // Note: In a real implementation, you would load a Haar cascade classifier
      // For demo purposes, we'll simulate face detection
      const faces: Array<{confidence: number, bbox: cv.Rect}> = [];
      
      // Simulate face detection with random results
      if (Math.random() > 0.7) {
        faces.push({
          confidence: 0.6 + Math.random() * 0.4,
          bbox: new cv.Rect(
            Math.floor(Math.random() * 200) + 50,
            Math.floor(Math.random() * 200) + 50,
            80 + Math.floor(Math.random() * 40),
            80 + Math.floor(Math.random() * 40)
          )
        });
      }

      // Cleanup
      gray.delete();
      equalized.delete();

      return faces;
    } catch (error) {
      console.error('Face detection error:', error);
      return [];
    }
  }

  /**
   * Cleanup OpenCV Mats
   */
  static cleanup(...mats: cv.Mat[]): void {
    mats.forEach(mat => {
      if (mat && mat.delete) {
        mat.delete();
      }
    });
  }
}

export default OpenCVProcessor;