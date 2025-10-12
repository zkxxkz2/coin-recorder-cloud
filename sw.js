// 金币记录器 - Service Worker（本地版本）
const CACHE_NAME = 'coin-tracker-local-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/styles.css',
  '/script.js',
  '/manifest.json'
];

// 安装事件 - 缓存静态资源
self.addEventListener('install', event => {
  console.log('Service Worker installing...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => {
        return self.skipWaiting();
      })
  );
});

// 激活事件 - 清理旧缓存
self.addEventListener('activate', event => {
  console.log('Service Worker activating...');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      return self.clients.claim();
    })
  );
});

// 获取事件 - 本地缓存优先策略（纯本地应用优化）
self.addEventListener('fetch', event => {
  // 只处理GET请求
  if (event.request.method !== 'GET') return;

  // 只处理同源请求（本地文件）
  if (!event.request.url.startsWith(self.location.origin)) {
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then(cachedResponse => {
        if (cachedResponse) {
          // 如果缓存中有，返回缓存版本
          return cachedResponse;
        }
        // 缓存中没有，尝试网络请求
        return fetch(event.request)
          .then(response => {
            // 网络请求成功，缓存响应
            if (response.ok) {
              const responseClone = response.clone();
              caches.open(CACHE_NAME).then(cache => {
                cache.put(event.request, responseClone);
              });
            }
            return response;
          })
          .catch(() => {
            // 网络请求失败，返回离线提示
            if (event.request.headers.get('accept').includes('text/html')) {
              return caches.match('/index.html');
            }
            return new Response('离线模式', {
              status: 503,
              statusText: 'Service Unavailable',
              headers: new Headers({
                'Content-Type': 'text/plain'
              })
            });
          });
      })
  );
});

// 推送通知处理（如果需要的话）
self.addEventListener('push', event => {
  if (event.data) {
    const data = event.data.json();
    const options = {
      body: data.body,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-72.png',
      vibrate: [100, 50, 100],
      data: data.url,
      actions: [
        {
          action: 'open',
          title: '打开应用',
          icon: '/icons/icon-96.png'
        }
      ]
    };

    event.waitUntil(
      self.registration.showNotification(data.title, options)
    );
  }
});

// 通知点击处理
self.addEventListener('notificationclick', event => {
  event.notification.close();

  if (event.action === 'open') {
    event.waitUntil(
      clients.openWindow(event.notification.data || '/')
    );
  }
});
