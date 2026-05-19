self.addEventListener('push', (event) => {
  if (!event.data) return;

  try {
    const data = event.data.json();
    const options = {
      body: data.body || 'New event detected',
      icon: data.icon || '/favicon.svg',
      badge: data.badge || '/favicon.svg',
      tag: data.tag || `sentryvision-${Date.now()}`,
      data: data.data || {},
      vibrate: [200, 100, 200],
      requireInteraction: data.requireInteraction || false,
      actions: data.actions || [],
    };

    event.waitUntil(
      self.registration.showNotification(data.title || 'SentryVision Alert', options)
    );
  } catch {
    event.waitUntil(
      self.registration.showNotification('SentryVision Alert', {
        body: 'New event detected on your security system',
        icon: '/favicon.svg',
        tag: `sentryvision-${Date.now()}`,
      })
    );
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const eventData = event.notification.data || {};
  const url = eventData.url || '/app/dashboard';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      return self.clients.openWindow(url);
    })
  );
});

self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil(
    self.registration.pushManager.getSubscription().then(async (subscription) => {
      if (subscription) {
        const resp = await fetch('/api/notifications/resubscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            endpoint: subscription.endpoint,
            keys: {
              p256dh: subscription.toJSON().keys.p256dh,
              auth: subscription.toJSON().keys.auth,
            },
          }),
        });
        if (!resp.ok) {
          console.error('Failed to resubscribe:', resp.status);
        }
      }
    })
  );
});
