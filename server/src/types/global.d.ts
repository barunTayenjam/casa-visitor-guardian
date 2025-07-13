import { StreamManager } from '../streams/rtspManager';
import { SimpleMotionDetection } from '../detection/simpleMotionDetection';
import { PersonDetector } from '../detection/personDetection';
import { BatchPersonDetection } from '../detection/batchPersonDetection';

declare global {
  var streamManager: StreamManager;
  var motionDetector: SimpleMotionDetection;
  var personDetector: PersonDetector;
  var batchPersonDetection: BatchPersonDetection;
  namespace NodeJS {
    interface Global {
      streamManager: StreamManager;
      motionDetector: SimpleMotionDetection;
      personDetector: PersonDetector;
      batchPersonDetection: BatchPersonDetection;
    }
  }
}