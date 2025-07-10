import { StreamManager } from '../streams/rtspManager';
import { SimpleMotionDetection } from '../detection/simpleMotionDetection';
import { PersonDetector } from '../detection/personDetection';

declare global {
  var streamManager: StreamManager;
  var motionDetector: SimpleMotionDetection;
  var personDetector: PersonDetector;
  namespace NodeJS {
    interface Global {
      streamManager: StreamManager;
      motionDetector: SimpleMotionDetection;
      personDetector: PersonDetector;
    }
  }
}