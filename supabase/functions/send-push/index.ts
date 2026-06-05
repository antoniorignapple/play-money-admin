import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.89.0'
import webpush from 'npm:web-push@3.6.7'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
    const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY')!
    const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY')!
    const VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT') || 'mailto:admin@playmoney.local'

    if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
      throw new Error('Config push incompleta: controlla SUPABASE_URL, SERVICE_ROLE_KEY, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY')
    }

    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)

    const body = await req.json().catch(() => ({}))
    if (body?.type !== 'simulazione_richiesta' || !body?.richiesta_id) {
      return new Response(JSON.stringify({ ok: false, error: 'Payload non valido' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

    const { data: richiesta, error: reqError } = await supabase
      .from('simulazioni_richieste')
      .select('id, venue_id, venue_name, requested_user_id, note, status')
      .eq('id', body.richiesta_id)
      .single()

    if (reqError || !richiesta) throw reqError || new Error('Richiesta non trovata')
    if (richiesta.status !== 'in_attesa') {
      return new Response(JSON.stringify({ ok: true, skipped: 'richiesta non in attesa' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: subs, error: subsError } = await supabase
      .from('push_subscriptions')
      .select('id, endpoint, p256dh, auth')
      .eq('user_id', richiesta.requested_user_id)
      .eq('enabled', true)

    if (subsError) throw subsError

    const locale = richiesta.venue_name || richiesta.venue_id || 'locale richiesto'
    const payload = JSON.stringify({
      title: 'Nuova simulazione assegnata',
      body: `Admin ti ha assegnato ${locale}. Tocca per visualizzarla.`,
      icon: './icons/icon-light-192.png',
      badge: './icons/icon-light-192.png',
      url: './?tab=simulazioni',
      type: 'simulazione_richiesta',
      richiesta_id: richiesta.id,
      tag: `simulazione-${richiesta.id}`,
    })

    let sent = 0
    let removed = 0

    await Promise.all((subs || []).map(async (s) => {
      try {
        await webpush.sendNotification({
          endpoint: s.endpoint,
          keys: { p256dh: s.p256dh, auth: s.auth },
        }, payload)
        sent += 1
      } catch (e) {
        const statusCode = e?.statusCode || e?.status
        if (statusCode === 404 || statusCode === 410) {
          await supabase.from('push_subscriptions').update({ enabled: false }).eq('id', s.id)
          removed += 1
        }
      }
    }))

    return new Response(JSON.stringify({ ok: true, sent, removed }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: e?.message || String(e) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
