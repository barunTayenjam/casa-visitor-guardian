import { StreamManager } from '../streams/rtspManager';
import { SimpleMotionDetection } from '../detection/simpleMotionDetection';

declare global {
  namespace NodeJS {
    interface Global {
      streamManager: StreamManager;
      motionDetector: SimpleMotionDetection;
    }
  }
}