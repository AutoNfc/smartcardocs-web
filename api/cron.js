const { createClient } = require('@supabase/supabase-js');
const webpush = require('web-push');

// Conexión a tu Base de Datos
const SUPABASE_URL = "https://ofeqicztagixejyqvuof.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9mZXFpY3p0YWdpeGVqeXF2dW9mIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMwMzcxMjAsImV4cCI6MjA5ODYxMzEyMH0.mMGzCSy2lCU-8hGMPblVCsY4YWtKldfP0CBCCaAolmQ";
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export default async function handler(req, res) {
    webpush.setVapidDetails('mailto:admin@mynexuz.cl', process.env.VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY);

    // 1. Traer vehículos (ahora incluimos el 'id' para poder cruzar los datos)
    const { data: vehiculos } = await supabase.from('vehiculos').select('id, vencimiento_soap, vencimiento_revision, vencimiento_permiso');
    
    // 2. Traer los avisos de WhatsApp que ya enviaste en los últimos 45 días
    const hace45Dias = new Date();
    hace45Dias.setDate(hace45Dias.getDate() - 45);
    const { data: avisos } = await supabase.from('avisos_enviados')
        .select('id_vehiculo, documento')
        .gte('enviado_en', hace45Dias.toISOString());

    let alertasPendientes = 0;
    
    if (vehiculos) {
        const hoy = new Date();
        vehiculos.forEach(v => {
            // Mapeamos los 3 documentos para revisarlos
            const docs = [
                { nombreCol: 'vencimiento_soap', tipo: 'soap' },
                { nombreCol: 'vencimiento_revision', tipo: 'revision' },
                { nombreCol: 'vencimiento_permiso', tipo: 'permiso' }
            ];

            docs.forEach(doc => {
                const fechaGuardada = v[doc.nombreCol];
                if (fechaGuardada) {
                    const fechaVen = new Date(fechaGuardada + "T23:59:59");
                    const diasRestantes = Math.ceil((fechaVen - hoy) / (1000 * 60 * 60 * 24));
                    
                    // Si el documento vence en 30 días o menos...
                    if (diasRestantes <= 30 && diasRestantes >= 0) {
                        // Verificamos si ya existe en la tabla de enviados para este auto y documento
                        const yaAvisado = avisos?.some(a => a.id_vehiculo === v.id && a.documento === doc.tipo);
                        
                        // Solo sumamos la alerta si NO le has avisado todavía
                        if (!yaAvisado) {
                            alertasPendientes++;
                        }
                    }
                }
            });
        });
    }

    // 3. Si el contador es cero, apagamos el motor sin molestar tu celular
    if (alertasPendientes === 0) {
        return res.status(200).json({ mensaje: "Todo al día. No hay alertas nuevas para enviar hoy." });
    }

    // 4. Si hay alertas NUEVAS, disparamos a los teléfonos con sus nombres
    const { data: suscripciones } = await supabase.from('suscripciones_push').select('*');
    if (!suscripciones || suscripciones.length === 0) return res.status(200).json({ mensaje: "Sin dispositivos." });

    let enviados = 0;
    for (const sub of suscripciones) {
        const nombre = sub.nombre || "Equipo";
        const notificacion = JSON.stringify({
            title: "Nexuz | Avisos Pendientes",
            body: `Buenos días ${nombre}. Tienes ${alertasPendientes} alertas de vencimiento para enviar hoy. ¡Que tengas un excelente día! ☀️🚗`,
            url: "/nx-k892j-metrics.html?token=MI_TOKEN_ADMIN_NEXUZ_2026"
        });

        try {
            await webpush.sendNotification({ endpoint: sub.endpoint, keys: { auth: sub.auth, p256dh: sub.p256dh } }, notificacion);
            enviados++;
        } catch (error) {
            if (error.statusCode === 410 || error.statusCode === 404) {
                await supabase.from('suscripciones_push').delete().eq('endpoint', sub.endpoint);
            }
        }
    }

    return res.status(200).json({ exito: true, enviados_a: enviados, alertas_nuevas: alertasPendientes });
}