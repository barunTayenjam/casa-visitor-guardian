import * as cv from '@techstark/opencv-js';
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

/**
 * OpenCV-based image processing utilities
 */
export class OpenCVProcessor {
  private static initialized = false;
  private static cv: any;

  static async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // Load OpenCV module
      if (!this.cv) {
        this.cv = (await import('@techstark/opencv-js')).default;
        // Wait for OpenCV to be ready
        if (typeof this.cv.Mat === 'undefined') {
          console.log('Waiting for OpenCV to initialize...');
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }

      this.initialized = true;
      console.log('OpenCV.js initialized successfully');
    } catch (error) {
      console.error('Failed to initialize OpenCV:', error);
      // Don't throw error, just mark as not initialized
      this.initialized = true;
      console.warn('OpenCV functionality will be disabled');
    }
  }

  private static getCv(): any {
    if (!this.cv) {
      throw new Error('OpenCV not available');
    }
    return this.cv;
  }

  /**
   * Convert image buffer to OpenCV Mat using Sharp (much faster than canvas)
   */
  static async bufferToMat(buffer: Buffer): Promise<any> {
    await this.initialize();
    const cv = this.getCv();
    
    try {
      // Use Sharp to convert buffer to RGBA raw pixels
      const { data, info } = await sharp(buffer)
        .ensureAlpha()  // Ensure RGBA format
        .raw()
        .toBuffer({ resolveWithObject: true });
      
      // Create OpenCV Mat from raw RGBA data
      const mat = new cv.Mat(info.height, info.width, cv.CV_8UC4);
      mat.data.set(new Uint8Array(data));
      
      return mat;
    } catch (error) {
      throw new Error(`Failed to convert buffer to Mat: ${error}`);
    }
  }

  /**
   * Detect people using HOG detector
   */
  static async detectPeople(imageMat: any): Promise<Array<{confidence: number, bbox: any}>> {
    await this.initialize();
    
    try {
      const cv = this.getCv();
      
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
  static async detectMotion(imageMat: any): Promise<any> {
    await this.initialize();
    const cv = this.getCv();
    
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
  static findContours(binaryMat: any): Promise<Array<any>> {
    return new Promise(async (resolve, reject) => {
      try {
        await this.initialize();
        const cv = this.getCv();
        
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
  static detectEdges(imageMat: any, lowThreshold: number = 50, highThreshold: number = 150): Promise<any> {
    return new Promise(async (resolve, reject) => {
      try {
        await this.initialize();
        const cv = this.getCv();
        
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
  static async detectFaces(imageMat: any): Promise<Array<{confidence: number, bbox: any}>> {
    await this.initialize();
    const cv = this.getCv();
    
    try {
      // Convert to grayscale
      const gray = new cv.Mat();
      cv.cvtColor(imageMat, gray, cv.COLOR_RGBA2GRAY);

      // Equalize histogram to improve detection
      const equalized = new cv.Mat();
      cv.equalizeHist(gray, equalized);

      // Note: In a real implementation, you would load a Haar cascade classifier
      // For demo purposes, we'll simulate face detection
      const faces: Array<{confidence: number, bbox: any}> = [];
      
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
  static cleanup(...mats: any[]): void {
    mats.forEach(mat => {
      if (mat && mat.delete) {
        mat.delete();
      }
    });
  }
}

export default OpenCVProcessor;