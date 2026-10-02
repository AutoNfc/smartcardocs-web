// El Vigilante de Nexuz: Escucha las notificaciones en segundo plano
self.addEventListener('push', function(event) {
    const data = event.data ? event.data.json() : {};
    
    const titulo = data.title || 'Nexuz Admin';
    const opciones = {
        body: data.body || 'Tienes nuevos avisos pendientes.',
        icon: '/img/icono-app.png',
        badge: '/img/icono-app.png',
        vibrate: [200, 100, 200],
        data: { url: data.url || '/' }
    };

    event.waitUntil(self.registration.showNotification(titulo, opciones));
});

// Qué pasa cuando tocas la notificación en tu pantalla bloqueada
self.addEventListener('notificationclick', function(event) {
    event.notification.close();
    event.waitUntil(clients.openWindow(event.notification.data.url));
});