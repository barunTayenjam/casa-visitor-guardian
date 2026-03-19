import webPush from 'web-push';
import { AppDataSource } from '../database.js';
import { NotificationSubscription } from '../models/NotificationSubscription.js';
import { NotificationLog } from '../models/NotificationLog.js';
import { NotificationPreferences } from '../models/NotificationPreferences.js';
import { Event } from '../models/Event.js';

const notificationSubscriptionRepository = AppDataSource.getRepository(NotificationSubscription);
const notificationLogRepository = AppDataSource.getRepository(NotificationLog);

interface NotificationPayload {
  title: string;
  body: string;
  icon?: string;
  image?: string;
  badge?: string;
  tag?: string;
  data?: Record<string, any>;
}

interface PushSubscription {
  endpoint: string;
  keys: {
    p256h: string;
    auth: string;
  };
}

export class NotificationService {
  private static vapidPublicKey: string;
  private static vapidPrivateKey: string;
  private static vapidSubject: string;

  static initialize() {
    this.vapidPublicKey = process.env.VAPID_PUBLIC_KEY || '';
    this.vapidPrivateKey = process.env.VAPID_PRIVATE_KEY || '';
    this.vapidSubject = process.env.VAPID_SUBJECT || 'mailto:admin@sentryvision.local';

    if (!this.vapidPublicKey || !this.vapidPrivateKey) {
      console.warn('VAPID keys not configured. Notifications will not work.');
      return;
    }

    webPush.setVapidDetails(
      this.vapidSubject,
      this.vapidPublicKey,
      this.vapidPrivateKey
    );

    console.log('Notification service initialized with VAPID keys');
  }

  static generateVAPIDKeys() {
    return webPush.generateVAPIDKeys();
  }

  static async subscribe(
    userId: string,
    subscription: PushSubscription
  ): Promise<NotificationSubscription> {
    try {
      const newSubscription = notificationSubscriptionRepository.create({
        userId,
        endpoint: subscription.endpoint,
        keysP256h: subscription.keys.p256h,
        keysAuth: subscription.keys.auth,
        isActive: true,
      });

      await notificationSubscriptionRepository.save(newSubscription);
      console.log(`User ${userId} subscribed to notifications`);
      return newSubscription;
    } catch (error) {
      console.error('Failed to save subscription:', error);
      throw error;
    }
  }

  static async unsubscribe(userId: string, endpoint: string): Promise<void> {
    try {
      await notificationSubscriptionRepository.delete({
        userId,
        endpoint,
      });
      console.log(`User ${userId} unsubscribed from notifications`);
    } catch (error) {
      console.error('Failed to unsubscribe:', error);
      throw error;
    }
  }

  static async getSubscription(userId: string): Promise<NotificationSubscription | null> {
    try {
      return await notificationSubscriptionRepository.findOne({
        where: { userId, isActive: true },
      });
    } catch (error) {
      console.error('Failed to get subscription:', error);
      throw error;
    }
  }

  static async sendPushNotification(
    subscription: NotificationSubscription,
    payload: NotificationPayload
  ): Promise<boolean> {
    const pushSubscription = {
      endpoint: subscription.endpoint,
      keys: {
        p256h: subscription.keysP256h,
        auth: subscription.keysAuth,
      },
    };

    try {
      await webPush.sendNotification(
        pushSubscription,
        JSON.stringify(payload)
      );

      await notificationSubscriptionRepository.update(subscription.id, {
        lastUsed: new Date(),
      });

      return true;
    } catch (error: any) {
      if (error.statusCode === 410) {
        await notificationSubscriptionRepository.update(subscription.id, {
          isActive: false,
        });
        console.log('Subscription expired, marked as inactive');
      } else {
        console.error('Failed to send push notification:', error);
      }
      return false;
    }
  }

  static async shouldNotify(userId: string, eventType: string): Promise<boolean> {
    try {
      const preferencesRepository = AppDataSource.getRepository(NotificationPreferences);
      const prefs = await preferencesRepository.findOne({ where: { userId } });

      if (!prefs) {
        return true;
      }

      if (eventType === 'motion' && !prefs.motionEnabled) return false;
      if (eventType === 'face' && !prefs.faceEnabled) return false;
      if (eventType === 'object' && !prefs.objectEnabled) return false;

      if (prefs.quietHoursEnabled) {
        const now = new Date();
        const currentTime = now.toTimeString().slice(0, 5);

        const isQuietHours = this.isTimeInQuietHours(
          currentTime,
          prefs.quietHoursStart,
          prefs.quietHoursEnd
        );

        if (isQuietHours) {
          console.log(`Quiet hours active for user ${userId}, skipping notification`);
          return false;
        }
      }

      return true;
    } catch (error) {
      console.error('Error checking notification preferences:', error);
      return true;
    }
  }

  private static isTimeInQuietHours(
    currentTime: string,
    startTime: string,
    endTime: string
  ): boolean {
    if (startTime < endTime) {
      return currentTime >= startTime && currentTime < endTime;
    } else {
      return currentTime >= startTime || currentTime < endTime;
    }
  }

  static async sendNotificationToUser(
    userId: string,
    payload: NotificationPayload,
    eventType: string,
    eventId?: string
  ): Promise<void> {
    const subscriptions = await notificationSubscriptionRepository.find({
      where: { userId, isActive: true },
    });

    if (subscriptions.length === 0) {
      console.log(`No active subscriptions found for user ${userId}`);
      return;
    }

    let successCount = 0;
    let failCount = 0;

    for (const subscription of subscriptions) {
      const success = await this.sendPushNotification(subscription, payload);

      const log = notificationLogRepository.create({
        userId,
        eventId: eventId || null,
        type: eventType,
        payload: payload as any,
        status: success ? 'success' : 'failed',
        errorMessage: success ? null : 'Failed to deliver push notification',
        retryCount: success ? 0 : 1,
      });

      await notificationLogRepository.save(log);

      if (success) {
        successCount++;
      } else {
        failCount++;
      }
    }

    console.log(
      `Notification sent to user ${userId}: ${successCount} success, ${failCount} failed`
    );
  }

  static async notifyMotionEvent(event: Event): Promise<void> {
    const cameraName = event.camera_id === 'cam1' ? 'Front Door' : 'Back Door';
    const timeStr = new Date(event.timestamp).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });

    const payload: NotificationPayload = {
      title: 'Motion Detected',
      body: `Motion detected at ${cameraName} (${timeStr})`,
      icon: '/icon-192.png',
      image: event.file_path ? `/api/events/image/${event.file_path.split('/').pop()}` : undefined,
      badge: '/badge-72.png',
      tag: `motion-${event.camera_id}`,
      data: {
        eventId: event.id,
        cameraId: event.camera_id,
        timestamp: event.timestamp,
        type: 'motion',
      },
    };

    await this.sendNotificationToAllUsers(payload, 'motion', event.id);
  }

  static async notifyUnknownFace(event: Event): Promise<void> {
    const cameraName = event.camera_id === 'cam1' ? 'Front Door' : 'Back Door';
    const timeStr = new Date(event.timestamp).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });

    const payload: NotificationPayload = {
      title: 'Unknown Face Detected',
      body: `Unknown person detected at ${cameraName} (${timeStr})`,
      icon: '/icon-192.png',
      image: event.file_path ? `/api/events/image/${event.file_path.split('/').pop()}` : undefined,
      badge: '/badge-72.png',
      tag: `face-unknown-${event.camera_id}`,
      data: {
        eventId: event.id,
        cameraId: event.camera_id,
        timestamp: event.timestamp,
        type: 'face',
        status: 'unknown',
      },
    };

    await this.sendNotificationToAllUsers(payload, 'face', event.id);
  }

  static async notifyObjectDetected(
    event: Event,
    objects: string[]
  ): Promise<void> {
    const cameraName = event.camera_id === 'cam1' ? 'Front Door' : 'Back Door';
    const timeStr = new Date(event.timestamp).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });

    const payload: NotificationPayload = {
      title: `${objects[0]?.charAt(0).toUpperCase() + objects[0]?.slice(1)} Detected`,
      body: `${objects.join(', ')} detected at ${cameraName} (${timeStr})`,
      icon: '/icon-192.png',
      image: event.file_path ? `/api/events/image/${event.file_path.split('/').pop()}` : undefined,
      badge: '/badge-72.png',
      tag: `object-${objects[0]}-${event.camera_id}`,
      data: {
        eventId: event.id,
        cameraId: event.camera_id,
        timestamp: event.timestamp,
        type: 'object',
        objects,
      },
    };

    await this.sendNotificationToAllUsers(payload, 'object', event.id);
  }

  static async notifySystemAlert(
    title: string,
    message: string
  ): Promise<void> {
    const payload: NotificationPayload = {
      title,
      body: message,
      icon: '/icon-192.png',
      badge: '/badge-72.png',
      tag: `system-${Date.now()}`,
      data: {
        type: 'system',
        timestamp: new Date().toISOString(),
      },
    };

    await this.sendNotificationToAllUsers(payload, 'system');
  }

  private static async sendNotificationToAllUsers(
    payload: NotificationPayload,
    eventType: string,
    eventId?: string
  ): Promise<void> {
    const { User } = await import('../models/index.js');
    const userRepository = AppDataSource.getRepository(User);

    const users = await userRepository.find();

    for (const user of users) {
      const shouldNotify = await this.shouldNotify(user.id, eventType);
      if (shouldNotify) {
        await this.sendNotificationToUser(user.id, payload, eventType, eventId);
      } else {
        console.log(`Notification for ${eventType} suppressed for user ${user.id} due to preferences`);
      }
    }
  }

  static async cleanupExpiredSubscriptions(): Promise<number> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const result = await notificationSubscriptionRepository
      .createQueryBuilder()
      .delete()
      .where('last_used < :date', { date: thirtyDaysAgo })
      .orWhere('is_active = :isActive', { isActive: false })
      .execute();

    console.log(`Cleaned up ${result.affected || 0} expired subscriptions`);
    return result.affected || 0;
  }

  static async getNotificationLogs(
    userId: string,
    limit: number = 50
  ): Promise<NotificationLog[]> {
    return await notificationLogRepository.find({
      where: { userId },
      order: { sentAt: 'DESC' },
      take: limit,
    });
  }
}

export default NotificationService;
