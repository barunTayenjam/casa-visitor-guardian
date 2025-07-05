import { StreamManager } from '../streams/rtspManager';
import { SimpleMotionDetection } from '../detection/simpleMotionDetection';

declare global {
  var streamManager: StreamManager;
  var motionDetector: SimpleMotionDetection;
  namespace NodeJS {
    interface Global {
      streamManager: StreamManager;
      motionDetector: SimpleMotionDetection;
    }
  }
}