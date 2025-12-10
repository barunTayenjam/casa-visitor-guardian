import { StreamManager } from '../streams/rtspManager';
import { SimpleMotionDetector } from '../detection/simpleMotionDetection';

declare global {
  var streamManager: StreamManager;
  var motionDetector: SimpleMotionDetector;
  namespace NodeJS {
    interface Global {
      streamManager: StreamManager;
      motionDetector: SimpleMotionDetector;
    }
  }
}