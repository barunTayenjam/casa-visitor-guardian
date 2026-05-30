import { apiClient, ApiError } from './baseClient';

interface NotificationPreferences {
  motion_enabled: boolean;
  face_enabled: boolean;
  object_enabled: boolean;
  quiet_hours_enabled: boolean;
  quiet_hours_start: string;
  quiet_hours_end: string;
  quiet_hours_timezone: string;
}

interface PushSubscriptionStatus {
  subscribed: boolean;
  endpoint?: string;
}

export const notificationService = {
  async getPreferences(): Promise<NotificationPreferences> {
    try {
      const response = await apiClient.get<NotificationPreferences>('/notifications/preferences');
      return response;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError('Failed to get notification preferences', 500, 'GET_NOTIFICATION_PREFERENCES_ERROR');
    }
  },

  async updatePreferences(prefs: Partial<NotificationPreferences>): Promise<{ message: string; preferences: NotificationPreferences }> {
    try {
      const response = await apiClient.put<{ message: string; preferences: NotificationPreferences }>('/notifications/preferences', prefs);
      return response;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError('Failed to update notification preferences', 500, 'UPDATE_NOTIFICATION_PREFERENCES_ERROR');
    }
  },

  async resetPreferences(): Promise<{ message: string; preferences: NotificationPreferences }> {
    try {
      const response = await apiClient.post<{ message: string; preferences: NotificationPreferences }>('/notifications/preferences/reset');
      return response;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError('Failed to reset notification preferences', 500, 'RESET_NOTIFICATION_PREFERENCES_ERROR');
    }
  },

  async sendTestNotification(): Promise<{ message: string }> {
    try {
      const response = await apiClient.post<{ message: string }>('/notifications/test');
      return response;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError('Failed to send test notification', 500, 'SEND_TEST_NOTIFICATION_ERROR');
    }
  },

  async getVapidPublicKey(): Promise<string> {
    try {
      const response = await apiClient.get<{ publicKey: string }>('/notifications/vapid-public-key');
      return response.publicKey;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError('Failed to get VAPID public key', 500, 'GET_VAPID_KEY_ERROR');
    }
  },

  async getSubscriptionStatus(): Promise<PushSubscriptionStatus> {
    try {
      const response = await apiClient.get<{ subscribed: boolean; id?: string; endpoint?: string }>('/notifications/subscription');
      return { subscribed: response.subscribed, endpoint: response.endpoint };
    } catch (error) {
      if (error instanceof ApiError) throw error;
      return { subscribed: false };
    }
  },

  async subscribeToPush(): Promise<PushSubscriptionStatus> {
    if (!('serviceWorker' in navigator)) {
      throw new ApiError('Service workers are not supported by this browser', 400, 'SW_NOT_SUPPORTED');
    }

    if (!('PushManager' in window)) {
      throw new ApiError('Push notifications are not supported by this browser', 400, 'PUSH_NOT_SUPPORTED');
    }

    const registration = await navigator.serviceWorker.ready;

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      throw new ApiError('Notification permission denied', 403, 'PERMISSION_DENIED');
    }

    const vapidKey = await this.getVapidPublicKey();

    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: vapidKey,
    });

    const subJson = subscription.toJSON();
    await apiClient.post('/notifications/subscribe', {
      endpoint: subscription.endpoint,
      keys: {
        p256dh: subJson.keys?.p256dh,
        auth: subJson.keys?.auth,
      },
    });

    return { subscribed: true, endpoint: subscription.endpoint };
  },

  async unsubscribeFromPush(): Promise<PushSubscriptionStatus> {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();

    if (subscription) {
      await apiClient.post('/notifications/unsubscribe', {
        endpoint: subscription.endpoint,
      });
      await subscription.unsubscribe();
    }

    return { subscribed: false };
  },
};
