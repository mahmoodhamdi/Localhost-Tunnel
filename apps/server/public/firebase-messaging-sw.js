/* eslint-disable no-undef */
// Firebase Cloud Messaging Service Worker
// This file handles background push notifications

importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging-compat.js');

// Firebase configuration will be injected via postMessage from the main app
let firebaseConfig = null;

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'FIREBASE_CONFIG') {
    firebaseConfig = event.data.config;
    initializeFirebase();
  }
});

function initializeFirebase() {
  if (!firebaseConfig) {
    console.warn('Firebase config not provided');
    return;
  }

  firebase.initializeApp(firebaseConfig);
  const messaging = firebase.messaging();

  // Handle background messages
  messaging.onBackgroundMessage((payload) => {
    console.log('[FCM SW] Received background message:', payload);

    const notificationTitle = payload.notification?.title || 'Localhost Tunnel';
    const notificationOptions = {
      body: payload.notification?.body || 'You have a new notification',
      icon: '/icons/icon-192x192.png',
      badge: '/icons/badge-72x72.png',
      tag: payload.data?.type || 'default',
      data: payload.data,
      requireInteraction: true,
      actions: getActionsForType(payload.data?.type),
    };

    self.registration.showNotification(notificationTitle, notificationOptions);
  });
}

// Get notification actions based on type
function getActionsForType(type) {
  switch (type) {
    case 'tunnel_connected':
    case 'tunnel_disconnected':
      return [
        { action: 'view', title: 'View Tunnel' },
        { action: 'dismiss', title: 'Dismiss' },
      ];
    case 'tunnel_error':
      return [
        { action: 'view', title: 'View Details' },
        { action: 'dismiss', title: 'Dismiss' },
      ];
    case 'tunnel_request':
      return [
        { action: 'inspect', title: 'Inspect' },
        { action: 'dismiss', title: 'Dismiss' },
      ];
    default:
      return [];
  }
}

// Handle notification click
self.addEventListener('notificationclick', (event) => {
  console.log('[FCM SW] Notification click:', event.action);

  event.notification.close();

  if (event.action === 'dismiss') {
    return;
  }

  const data = event.notification.data;
  let url = '/';

  if (data?.tunnelId) {
    if (event.action === 'inspect') {
      url = `/tunnels/${data.tunnelId}?tab=requests`;
    } else {
      url = `/tunnels/${data.tunnelId}`;
    }
  }

  // Focus existing window or open new one
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // Check if there's already a window open
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.focus();
          client.navigate(url);
          return;
        }
      }
      // Otherwise, open a new window
      if (clients.openWindow) {
        return clients.openWindow(url);
      }
    })
  );
});
