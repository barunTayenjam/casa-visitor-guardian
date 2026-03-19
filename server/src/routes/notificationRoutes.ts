import { Router, Request, Response } from 'express';
import { AppDataSource } from '../database.js';
import { NotificationSubscription } from '../models/NotificationSubscription.js';
import { NotificationLog } from '../models/NotificationLog.js';
import { NotificationPreferences } from '../models/NotificationPreferences.js';
import NotificationService from '../services/notificationService.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

router.use(authenticate());

router.post('/subscribe', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const { endpoint, keys } = req.body;

    if (!endpoint || !keys || !keys.p256h || !keys.auth) {
      return res.status(400).json({ error: 'Invalid subscription format' });
    }

    const subscription = await NotificationService.subscribe(userId, {
      endpoint,
      keys: {
        p256h: keys.p256h,
        auth: keys.auth,
      },
    });

    res.status(201).json({
      id: subscription.id,
      message: 'Subscribed to notifications successfully',
    });
  } catch (error) {
    console.error('Subscribe error:', error);
    res.status(500).json({ error: 'Failed to subscribe to notifications' });
  }
});

router.delete('/unsubscribe', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const { endpoint } = req.body;

    if (!endpoint) {
      return res.status(400).json({ error: 'Endpoint is required' });
    }

    await NotificationService.unsubscribe(userId, endpoint);

    res.json({ message: 'Unsubscribed successfully' });
  } catch (error) {
    console.error('Unsubscribe error:', error);
    res.status(500).json({ error: 'Failed to unsubscribe' });
  }
});

router.get('/subscription', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;

    const subscription = await NotificationService.getSubscription(userId);

    if (!subscription) {
      return res.status(404).json({ error: 'No active subscription found' });
    }

    res.json({
      id: subscription.id,
      endpoint: subscription.endpoint,
      keys: {
        p256h: subscription.keysP256h,
        auth: subscription.keysAuth,
      },
      createdAt: subscription.createdAt,
      lastUsed: subscription.lastUsed,
    });
  } catch (error) {
    console.error('Get subscription error:', error);
    res.status(500).json({ error: 'Failed to get subscription' });
  }
});

router.get('/vapid-public-key', (req: Request, res: Response) => {
  const vapidPublicKey = process.env.VAPID_PUBLIC_KEY;

  if (!vapidPublicKey) {
    return res.status(500).json({ error: 'VAPID keys not configured' });
  }

  res.json({ publicKey: vapidPublicKey });
});

router.get('/logs', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const limit = parseInt(req.query.limit as string) || 50;

    const logs = await NotificationService.getNotificationLogs(userId, limit);

    res.json({
      logs: logs.map((log) => ({
        id: log.id,
        eventId: log.eventId,
        type: log.type,
        payload: log.payload,
        status: log.status,
        errorMessage: log.errorMessage,
        sentAt: log.sentAt,
        retryCount: log.retryCount,
      })),
    });
  } catch (error) {
    console.error('Get logs error:', error);
    res.status(500).json({ error: 'Failed to get notification logs' });
  }
});

router.post('/test', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;

    await NotificationService.sendNotificationToUser(
      userId,
      {
        title: 'Test Notification',
        body: 'This is a test notification from SentryVision',
        icon: '/icon-192.png',
        badge: '/badge-72.png',
      },
      'test'
    );

    res.json({ message: 'Test notification sent' });
  } catch (error) {
    console.error('Test notification error:', error);
    res.status(500).json({ error: 'Failed to send test notification' });
  }
});

router.get('/preferences', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const preferencesRepository = AppDataSource.getRepository(NotificationPreferences);

    let preferences = await preferencesRepository.findOne({ where: { userId } });

    if (!preferences) {
      preferences = preferencesRepository.create({
        userId,
        motionEnabled: true,
        faceEnabled: true,
        objectEnabled: true,
        quietHoursEnabled: false,
        quietHoursStart: '22:00',
        quietHoursEnd: '06:00',
        quietHoursTimezone: 'Asia/Kolkata',
      });
      await preferencesRepository.save(preferences);
    }

    res.json({
      motion_enabled: preferences.motionEnabled,
      face_enabled: preferences.faceEnabled,
      object_enabled: preferences.objectEnabled,
      quiet_hours_enabled: preferences.quietHoursEnabled,
      quiet_hours_start: preferences.quietHoursStart,
      quiet_hours_end: preferences.quietHoursEnd,
      quiet_hours_timezone: preferences.quietHoursTimezone,
    });
  } catch (error) {
    console.error('Get preferences error:', error);
    res.status(500).json({ error: 'Failed to get preferences' });
  }
});

router.put('/preferences', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const preferencesRepository = AppDataSource.getRepository(NotificationPreferences);

    let preferences = await preferencesRepository.findOne({ where: { userId } });

    if (!preferences) {
      preferences = preferencesRepository.create({ userId });
    }

    if (req.body.motion_enabled !== undefined) preferences.motionEnabled = req.body.motion_enabled;
    if (req.body.face_enabled !== undefined) preferences.faceEnabled = req.body.face_enabled;
    if (req.body.object_enabled !== undefined) preferences.objectEnabled = req.body.object_enabled;
    if (req.body.quiet_hours_enabled !== undefined) preferences.quietHoursEnabled = req.body.quiet_hours_enabled;
    if (req.body.quiet_hours_start !== undefined) preferences.quietHoursStart = req.body.quiet_hours_start;
    if (req.body.quiet_hours_end !== undefined) preferences.quietHoursEnd = req.body.quiet_hours_end;
    if (req.body.quiet_hours_timezone !== undefined) preferences.quietHoursTimezone = req.body.quiet_hours_timezone;

    await preferencesRepository.save(preferences);

    res.json({
      message: 'Preferences updated successfully',
      preferences: {
        motion_enabled: preferences.motionEnabled,
        face_enabled: preferences.faceEnabled,
        object_enabled: preferences.objectEnabled,
        quiet_hours_enabled: preferences.quietHoursEnabled,
        quiet_hours_start: preferences.quietHoursStart,
        quiet_hours_end: preferences.quietHoursEnd,
        quiet_hours_timezone: preferences.quietHoursTimezone,
      },
    });
  } catch (error) {
    console.error('Update preferences error:', error);
    res.status(500).json({ error: 'Failed to update preferences' });
  }
});

router.post('/preferences/reset', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const preferencesRepository = AppDataSource.getRepository(NotificationPreferences);

    let preferences = await preferencesRepository.findOne({ where: { userId } });

    if (!preferences) {
      preferences = preferencesRepository.create({ userId });
    }

    preferences.motionEnabled = true;
    preferences.faceEnabled = true;
    preferences.objectEnabled = true;
    preferences.quietHoursEnabled = false;
    preferences.quietHoursStart = '22:00';
    preferences.quietHoursEnd = '06:00';
    preferences.quietHoursTimezone = 'Asia/Kolkata';

    await preferencesRepository.save(preferences);

    res.json({
      message: 'Preferences reset to defaults successfully',
      preferences: {
        motion_enabled: preferences.motionEnabled,
        face_enabled: preferences.faceEnabled,
        object_enabled: preferences.objectEnabled,
        quiet_hours_enabled: preferences.quietHoursEnabled,
        quiet_hours_start: preferences.quietHoursStart,
        quiet_hours_end: preferences.quietHoursEnd,
        quiet_hours_timezone: preferences.quietHoursTimezone,
      },
    });
  } catch (error) {
    console.error('Reset preferences error:', error);
    res.status(500).json({ error: 'Failed to reset preferences' });
  }
});

export default router;
