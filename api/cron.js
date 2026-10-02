const { createClient } = require('@supabase/supabase-js');
const webpush = require('web-push');

// Conexión a tu Base de Datos
const SUPABASE_URL = "https://ofeqicztagixejyqvuof.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9mZXFpY3p0YWdpeGVqeXF2dW9mIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMwMzcxMjAsImV4cCI6MjA5ODYxMzEyMH0.mMGzCSy2lCU-8hGMPblVCsY4YWtKldfP0CBCCaAolmQ";
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export default async function handler(req, res) {
    // 1. Configuramos las llaves de seguridad de Apple
    webpush.setVapidDetails(
        'mailto:admin@mynexuz.cl',
        process.env.VAPID_PUBLIC_KEY,
        process.env.VAPID_PRIVATE_KEY
    );

    // 2. Buscamos en tu bóveda los iPhones registrados
    const { data: suscripciones, error } = await supabase.from('suscripciones_push').select('*');
    if (!suscripciones || suscripciones.length === 0) {
        return res.status(200).json({ mensaje: "Nadie a quien notificar hoy." });
    }

    // 3. El mensaje que llegará a tu pantalla bloqueada
    const notificacion = JSON.stringify({
        title: "Nexuz | Avisos Pendientes",
        body: "Buen día Eliseo. Revisa el panel para enviar las alertas de vencimiento de hoy. 🚗",
        url: "/nx-k892j-metrics.html?token=MI_TOKEN_ADMIN_NEXUZ_2026"
    });

    // 4. Disparamos la alerta a todos los teléfonos guardados
    let enviados = 0;
    for (const sub of suscripciones) {
        try {
            await webpush.sendNotification({
                endpoint: sub.endpoint,
                keys: { auth: sub.auth, p256dh: sub.p256dh }
            }, notificacion);
            enviados++;
        } catch (error) {
            // Si cambiaste de iPhone o borraste la app, limpiamos la base de datos
            if (error.statusCode === 410 || error.statusCode === 404) {
                await supabase.from('suscripciones_push').delete().eq('endpoint', sub.endpoint);
            }
        }
    }

    return res.status(200).json({ exito: true, enviados_a: enviados });
}