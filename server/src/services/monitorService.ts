import { promises as fsp } from 'node:fs';
import { AppDataSource } from '../database.js';
import { serviceRegistry } from './serviceRegistry.js';
import { logger } from '../utils/logger.js';
import NotificationService from './notificationService.js';

const DISK_ALERT_PERCENT = Number(process.env.DISK_ALERT_PERCENT) || 10;
const DISK_ALERT_COOLDOWN_MS = 6 * 60 * 60 * 1000;
const PIPELINE_ALERT_COOLDOWN_MS = 30 * 60 * 1000;
const HEARTBEAT_URL = process.env.HEARTBEAT_URL || '';
const HEARTBEAT_TIMEOUT_MS = 5000;

export interface DiskUsage {
  freeBytes: number;
  totalBytes: number;
  freePercent: number;
}

export interface MonitorResult {
  disk: DiskUsage | null;
  diskAlerted: boolean;
  pipelineConnected: boolean;
  pipelineAlerted: boolean;
  failedJobs: number;
  failedJobsAlerted: boolean;
  heartbeatSent: boolean;
}

let lastDiskAlertAt = 0;
let lastPipelineAlertAt = 0;
let failedJobsAlertLatched = false;

export function resetMonitorAlertState(): void {
  lastDiskAlertAt = 0;
  lastPipelineAlertAt = 0;
  failedJobsAlertLatched = false;
}

export async function getDiskUsage(dir: string): Promise<DiskUsage | null> {
  try {
    const stats = await fsp.statfs(dir);
    const freeBytes = Number(stats.bavail) * Number(stats.bsize);
    const totalBytes = Number(stats.blocks) * Number(stats.bsize);
    if (totalBytes <= 0) return null;
    return {
      freeBytes,
      totalBytes,
      freePercent: Math.round((freeBytes / totalBytes) * 1000) / 10,
    };
  } catch {
    return null;
  }
}

async function alert(title: string, body: string): Promise<void> {
  try {
    await NotificationService.notifySystemAlert(title, body);
  } catch (err) {
    logger.warn(`[Monitor] failed to send alert "${title}"`, 'Monitor', err);
  }
}

async function sendHeartbeat(): Promise<boolean> {
  if (!HEARTBEAT_URL) return false;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), HEARTBEAT_TIMEOUT_MS);
    await fetch(HEARTBEAT_URL, { method: 'GET', signal: controller.signal });
    clearTimeout(timer);
    return true;
  } catch {
    return false;
  }
}

export async function runMonitorChecks(
  dataDir: string,
  diskProvider: (dir: string) => Promise<DiskUsage | null> = getDiskUsage,
): Promise<MonitorResult> {
  const now = Date.now();

  const disk = await diskProvider(dataDir);
  let diskAlerted = false;
  if (disk && disk.freePercent < DISK_ALERT_PERCENT && now - lastDiskAlertAt > DISK_ALERT_COOLDOWN_MS) {
    lastDiskAlertAt = now;
    diskAlerted = true;
    await alert(
      'Low disk space',
      `Storage for camera events is at ${disk.freePercent}% free (${Math.round(disk.freeBytes / 1e9)}GB). Review retention settings or archive old events.`,

    );
  }

  let pipelineConnected = true;
  try {
    pipelineConnected = serviceRegistry.getPythonWsClient()?.connected ?? true;
  } catch {
    /* registry not populated yet — treat as unknown/healthy */
  }
  let pipelineAlerted = false;
  if (!pipelineConnected && now - lastPipelineAlertAt > PIPELINE_ALERT_COOLDOWN_MS) {
    lastPipelineAlertAt = now;
    pipelineAlerted = true;
    await alert(
      'Detection pipeline offline',
      'The backend lost its connection to the OpenCV detection service. Motion detection and recording are not running.',

    );
  }

  let failedJobs = 0;
  try {
    const rows = (await AppDataSource.query(
      "SELECT count(*)::int AS n FROM relation_jobs WHERE status = 'failed'",
    )) as Array<{ n: number }>;
    failedJobs = rows[0]?.n ?? 0;
  } catch {
    /* queue table missing or DB down — skip */
  }
  let failedJobsAlerted = false;
  if (failedJobs > 0 && !failedJobsAlertLatched) {
    failedJobsAlertLatched = true;
    failedJobsAlerted = true;
    await alert(
      'Relation jobs failing',
      `${failedJobs} relation enrichment job(s) exhausted their retries. Events still open normally; check the relations service.`,

    );
  } else if (failedJobs === 0) {
    failedJobsAlertLatched = false;
  }

  let heartbeatSent = false;
  if (HEARTBEAT_URL && pipelineConnected) {
    heartbeatSent = await sendHeartbeat();
    if (!heartbeatSent) logger.warn('[Monitor] heartbeat ping failed', 'Monitor');
  }

  return { disk, diskAlerted, pipelineConnected, pipelineAlerted, failedJobs, failedJobsAlerted, heartbeatSent };
}
