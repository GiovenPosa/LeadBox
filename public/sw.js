// ============================================
// SERVICE WORKER - Push Notifications + Badges
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
      { action: 'view', title: 'View' },
      { action: 'dismiss', title: 'Dismiss' },
    ],
  };

  event.waitUntil(
    Promise.all([
      // Show the notification
      self.registration.showNotification(data.title || 'LeadBox', options),
      // Increment the app badge
      incrementAppBadge(),
    ])
  );
});

// ============================================
// APP BADGE MANAGEMENT
// ============================================

async function incrementAppBadge() {
  if (!('setAppBadge' in navigator)) {
    console.log('[SW] App badge not supported');
    return;
  }

  try {
    // Get current notifications to count them
    const notifications = await self.registration.getNotifications();
    const count = notifications.length + 1; // +1 for the one we just showed
    
    await navigator.setAppBadge(count);
    console.log('[SW] App badge set to:', count);
  } catch (err) {
    console.error('[SW] Error setting app badge:', err);
  }
}

async function updateBadgeFromNotifications() {
  if (!('setAppBadge' in navigator)) return;
  
  try {
    const notifications = await self.registration.getNotifications();
    if (notifications.length > 0) {
      await navigator.setAppBadge(notifications.length);
    } else {
      await navigator.clearAppBadge();
    }
    console.log('[SW] Badge updated to:', notifications.length);
  } catch (err) {
    console.error('[SW] Error updating badge:', err);
  }
}

// ---- Listen for messages from the client ----
self.addEventListener('message', (event) => {
  if (!event.data) return;

  switch (event.data.type) {
    case 'CLEAR_BADGE':
      clearAppBadge();
      break;
    case 'SET_BADGE':
      setAppBadgeCount(event.data.count);
      break;
  }
});

async function clearAppBadge() {
  if ('clearAppBadge' in navigator) {
    try {
      await navigator.clearAppBadge();
      console.log('[SW] App badge cleared');
    } catch (err) {
      console.error('[SW] Error clearing app badge:', err);
    }
  }
}

async function setAppBadgeCount(count) {
  if ('setAppBadge' in navigator) {
    try {
      if (count > 0) {
        await navigator.setAppBadge(count);
      } else {
        await navigator.clearAppBadge();
      }
      console.log('[SW] App badge set to:', count);
    } catch (err) {
      console.error('[SW] Error setting app badge:', err);
    }
  }
}

// ---- Notification Click ----
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const action = event.action;
  const data = event.notification.data;

  // Dismiss action - just close
  if (action === 'dismiss') {
    updateBadgeFromNotifications();
    return;
  }

  // View action or notification body click - open/focus the app
  const targetUrl = data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // Update badge after closing notification
      updateBadgeFromNotifications();
      
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

// ---- Notification Close ----
self.addEventListener('notificationclose', (event) => {
  console.log('Notification dismissed:', event.notification.tag);
  // Update badge when notification is swiped away
  updateBadgeFromNotifications();
});

// ---- Push Subscription Change ----
self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil(
    self.registration.pushManager
      .subscribe(event.oldSubscription.options)
      .then((subscription) => {
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