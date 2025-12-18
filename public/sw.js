// ============================================
// SERVICE WORKER - Push Notifications + Caching
// ============================================

const CACHE_NAME = 'leadbox-v1';

// ---- Install ----
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

// ---- Activate ----
self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// ---- Fetch (network-first for now) ----
self.addEventListener('fetch', (event) => {
  event.respondWith(fetch(event.request));
});

// ============================================
// PUSH NOTIFICATIONS
// ============================================

self.addEventListener('push', (event) => {
  if (!event.data) return;

  let data;
  try {
    data = event.data.json();
  } catch (e) {
    // Fallback for plain text
    data = {
      title: 'New Notification',
      body: event.data.text(),
    };
  }

  const options = {
    body: data.body || 'You have a new notification',
    icon: '/icons/icon-192.png',
    badge: '/icons/badge-72.png',
    vibrate: [100, 50, 100],
    tag: data.tag || 'leadbox-notification',
    renotify: true,
    requireInteraction: data.requireInteraction ?? true,
    data: {
      url: data.url || '/',
      inquiryId: data.inquiryId,
      timestamp: Date.now(),
    },
    actions: data.actions || [
      {
        action: 'view',
        title: 'View',
      },
      {
        action: 'dismiss',
        title: 'Dismiss',
      },
    ],
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'LeadBox', options)
  );
});

// ---- Notification Click ----
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const action = event.action;
  const data = event.notification.data;

  // Dismiss action - just close
  if (action === 'dismiss') {
    return;
  }

  // View action or notification body click - open/focus the app
  const targetUrl = data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // Check if there's already a window open
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          // Navigate existing window to the target URL
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      // No existing window - open new one
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});

// ---- Notification Close (optional tracking) ----
self.addEventListener('notificationclose', (event) => {
  // Could track dismissed notifications here if needed
  console.log('Notification dismissed:', event.notification.tag);
});

// ---- Push Subscription Change ----
// Handle when browser refreshes the subscription
self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil(
    // Re-subscribe with the same options
    self.registration.pushManager
      .subscribe(event.oldSubscription.options)
      .then((subscription) => {
        // Send new subscription to your server
        return fetch('/api/push/resubscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            oldEndpoint: event.oldSubscription.endpoint,
            newSubscription: subscription.toJSON(),
          }),
        });
      })
  );
});