import path from 'node:path';
import { config } from './index.js';

export const getDetectionsPath = (
  type: 'events' | 'snapshots' | 'batch' | 'temp',
  date: Date = new Date(),
): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const yearMonth = `${year}-${month}`;

  if (type === 'events') {
    return path.join(config.storage.detectionsDir, yearMonth, 'events');
  } else if (type === 'snapshots') {
    return path.join(config.storage.detectionsDir, yearMonth, 'snapshots');
  } else if (type === 'batch') {
    return path.join(config.storage.detectionsDir, yearMonth, 'batch-results');
  } else {
    return path.join(config.storage.detectionsDir, yearMonth, 'temp');
  }
};

export const getEventPath = (subType: 'faces' | 'motion', date: Date = new Date()): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const yearMonth = `${year}-${month}`;
  return path.join(config.storage.detectionsDir, yearMonth, 'events', subType);
};

export const getArchivePath = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const yearMonth = `${year}-${month}`;
  return path.join(config.storage.archivePath, yearMonth);
};

export const getStoragePathFromFile = (
  fileType: 'event_face' | 'event_motion' | 'snapshot' | 'batch_result' | 'temp',
  date: Date = new Date(),
): string => {
  if (fileType === 'event_face') {
    return getEventPath('faces', date);
  } else if (fileType === 'event_motion') {
    return getEventPath('motion', date);
  } else if (fileType === 'snapshot') {
    return getDetectionsPath('snapshots', date);
  } else if (fileType === 'batch_result') {
    return getDetectionsPath('batch', date);
  } else {
    return getDetectionsPath('temp', date);
  }
};
