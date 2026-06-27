import { useEffect, useState } from 'react'
import {
  ShieldCheck, Database, FileText, ExternalLink, RefreshCw, AlertCircle,
  Server, KeyRound, Code, GitBranch, Lock, CheckCircle2,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { Button, IconButton, Card, Badge, Stat } from '../components/ui'
import { PageLayout, PageHeader, PageBody } from '../components/PageLayout'
import { useToast } from '../components/Toast'

const SUPABASE_URL = 'https://ufkgncqqvqgynncswkiv.supabase.co'

export default function AdminPage() {
  const toast = useToast()
  const [stats, setStats] = useState({
    venues: '—', dipendenti: '—', movements: '—',
    movementsTrash: '—', fondi: '—', machines: '—',
  })
  const [loading, setLoading] = useState(true)
  const [softDeleteOk, setSoftDeleteOk] = useState(null)

  useEffect(() => { loadStats() }, [])

  async function loadStats() {
    setLoading(true)
    try {
      const [venues, dipendenti, movements, trash, fondi, machines] = await Promise.all([
        supabase.from('venues').select('*', { count: 'exact', head: true }),
        supabase.from('dipendenti').select('*', { count: 'exact', head: true }),
        supabase.from('movements_cassa').select('*', { count: 'exact', head: true }).is('deleted_at', null),
        supabase.from('movements_cassa').select('*', { count: 'exact', head: true }).not('deleted_at', 'is', null),
        supabase.from('fondo_cassa_giornaliero').select('*', { count: 'exact', head: true }),
        supabase.from('machines').select('*', { count: 'exact', head: true }),
      ])
      setStats({
        venues: venues.count ?? 0,
        dipendenti: dipendenti.count ?? 0,
        movements: movements.count ?? 0,
        movementsTrash: trash.count ?? 0,
        fondi: fondi.count ?? 0,
        machines: machines.count ?? 0,
      })
      setSoftDeleteOk(!trash.error)
    } catch (e) {
      toast.error(`Errore: ${e.message}`)
      setSoftDeleteOk(false)
    } finally {
      setLoading(false)
    }
  }

  return (
    <PageLayout>
      <PageHeader
        title="ADMIN"
        subtitle="Strumenti amministrativi e info sistema"
        actions={
          <IconButton icon={RefreshCw} onClick={loadStats} title="Aggiorna" />
        }
      />

      <PageBody>
        <div className="mx-auto max-w-[1200px] space-y-4 px-3 py-3 md:space-y-5 md:px-5 md:py-4">
          {/* Status migration */}
          {softDeleteOk === false && (
            <div className="flex items-start gap-2.5 rounded-lg border border-[var(--color-warning-border)] bg-[var(--color-warning-soft)] px-3 py-2.5 md:px-4 md:py-3">
              <AlertCircle size={16} className="mt-0.5 shrink-0 text-[var(--color-warning)]" strokeWidth={2} />
              <div>
                <p className="text-[13px] font-medium text-[var(--color-text)]">Migration richiesta</p>
                <p className="text-[12px] text-[var(--color-text-secondary)]">
                  Devi eseguire la migration <code className="rounded bg-white px-1 py-0.5 font-mono text-[11px]">01_soft_delete.sql</code> sul tuo database Supabase per abilitare il Cestino.
                </p>
              </div>
            </div>
          )}

          {softDeleteOk === true && (
            <div className="flex items-start gap-2.5 rounded-lg border border-[var(--color-success-border)] bg-[var(--color-success-soft)] px-3 py-2.5 md:px-4 md:py-3">
              <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-[var(--color-success)]" strokeWidth={2} />
              <p className="text-[13px] font-medium text-[var(--color-text)]">
                Database OK · Cestino attivo · Tutte le migrations applicate
              </p>
            </div>
          )}

          <section>
            <h3 className="mb-2 text-[14px] font-semibold text-[var(--color-text)] md:mb-3">
              Statistiche database
            </h3>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-3 md:gap-3 lg:grid-cols-6">
              <Stat label="Locali" value={loading ? '—' : stats.venues} icon={Database} />
              <Stat label="Agenti" value={loading ? '—' : stats.dipendenti} icon={Database} />
              <Stat label="Movimenti" value={loading ? '—' : stats.movements} icon={Database} tone="accent" />
              <Stat label="In cestino" value={loading ? '—' : stats.movementsTrash} icon={Database} tone="danger" />
              <Stat label="Fondi cassa" value={loading ? '—' : stats.fondi} icon={Database} />
              <Stat label="Machines" value={loading ? '—' : stats.machines} icon={Database} />
            </div>
          </section>

          <section>
            <h3 className="mb-2 text-[14px] font-semibold text-[var(--color-text)] md:mb-3">
              Strumenti
            </h3>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <AdminToolCard
                icon={Database}
                title="Supabase Dashboard"
                description="Apri la console Supabase per gestire tabelle, query SQL, log e funzioni edge."
                action={
                  <Button
                    size="sm" variant="secondary" iconRight={ExternalLink}
                    onClick={() => window.open(`${SUPABASE_URL}`, '_blank')}
                  >
                    Apri
                  </Button>
                }
              />
              <AdminToolCard
                icon={Server}
                title="Edge Function · admin-update-user"
                description="Funzione Edge per creare/aggiornare/eliminare utenti tramite Service Role."
                action={<Badge variant="success" size="sm"><CheckCircle2 size={10} strokeWidth={2.5} />attiva</Badge>}
              />
              <AdminToolCard
                icon={FileText}
                title="Migration SQL · Soft Delete"
                description="File SQL da eseguire una sola volta su Supabase per abilitare il Cestino."
                action={
                  <Button
                    size="sm" variant="secondary" iconRight={ExternalLink}
                    onClick={() => window.open(`${SUPABASE_URL}/project/_/sql`, '_blank')}
                  >
                    SQL Editor
                  </Button>
                }
              />
              <AdminToolCard
                icon={KeyRound}
                title="RLS Policies"
                description="Gestisci le Row Level Security policies."
                action={
                  <Button
                    size="sm" variant="secondary" iconRight={ExternalLink}
                    onClick={() => window.open(`${SUPABASE_URL}/project/_/auth/policies`, '_blank')}
                  >
                    Policies
                  </Button>
                }
              />
            </div>
          </section>

          <section>
            <h3 className="mb-2 text-[14px] font-semibold text-[var(--color-text)] md:mb-3">
              Informazioni sistema
            </h3>
            <Card>
              <div className="divide-y divide-[var(--color-border)]">
                <InfoRow label="Versione applicazione" value="Play Money Admin v3.1 (PWA + Mobile)" icon={Code} />
                <InfoRow label="Branch produzione" value="main" icon={GitBranch} />
                <InfoRow label="Supabase Project URL" value={SUPABASE_URL} icon={Server} mono />
                <InfoRow label="Edge Function" value="admin-update-user" icon={Lock} mono />
                <InfoRow
                  label="Operatore corrente"
                  value="Giovanni Papagni"
                  icon={ShieldCheck}
                />
              </div>
            </Card>
          </section>

          <section className="hidden md:block">
            <h3 className="mb-2 text-[14px] font-semibold text-[var(--color-text)] md:mb-3">
              Scorciatoie tastiera
            </h3>
            <Card>
              <div className="grid grid-cols-1 gap-px overflow-hidden bg-[var(--color-border)] md:grid-cols-2">
                <ShortcutRow keys={['⌘', 'K']} label="Apri Command Palette" />
                <ShortcutRow keys={['⌘', 'B']} label="Comprimi/espandi sidebar" />
                <ShortcutRow keys={['C']} label="Vai a Cassa" />
                <ShortcutRow keys={['A']} label="Vai a Agenti" />
                <ShortcutRow keys={['L']} label="Vai a Locali" />
                <ShortcutRow keys={['N']} label="Vai a Analisi" />
                <ShortcutRow keys={['M']} label="Vai a Automezzi" />
                <ShortcutRow keys={['T']} label="Vai a Cestino" />
                <ShortcutRow keys={['D']} label="Vai a ADMIN" />
              </div>
            </Card>
          </section>
        </div>
      </PageBody>
    </PageLayout>
  )
}

function AdminToolCard({ icon: Icon, title, description, action }) {
  return (
    <Card>
      <div className="flex flex-col gap-3 p-3 md:flex-row md:items-start md:p-4">
        <div className="flex items-start gap-3 flex-1">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-secondary)]">
            <Icon size={15} strokeWidth={2} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-medium text-[var(--color-text)]">{title}</p>
            <p className="mt-0.5 text-[12px] text-[var(--color-text-muted)]">{description}</p>
          </div>
        </div>
        <div className="shrink-0">{action}</div>
      </div>
    </Card>
  )
}

function InfoRow({ label, value, icon: Icon, mono }) {
  return (
    <div className="flex flex-col gap-1 px-3 py-2.5 md:flex-row md:items-center md:gap-3 md:px-4">
      <div className="flex items-center gap-2 flex-1">
        <Icon size={13} className="shrink-0 text-[var(--color-text-muted)]" strokeWidth={2} />
        <p className="text-[12px] text-[var(--color-text-secondary)]">{label}</p>
      </div>
      <p className={`text-[12px] text-[var(--color-text)] md:text-right ${mono ? 'font-mono break-all' : 'font-medium'}`}>{value}</p>
    </div>
  )
}

function ShortcutRow({ keys, label }) {
  return (
    <div className="flex items-center gap-3 bg-white px-4 py-2.5">
      <div className="flex items-center gap-1">
        {keys.map((k, i) => (
          <kbd key={i} className="inline-flex h-5 min-w-[20px] items-center justify-center rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-1 font-mono text-[10px] font-medium text-[var(--color-text-secondary)]">{k}</kbd>
        ))}
      </div>
      <span className="text-[12px] text-[var(--color-text-secondary)]">{label}</span>
    </div>
  )
}
