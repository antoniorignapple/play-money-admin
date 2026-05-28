// ============ DATE UTILS ============
export function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

export function firstDayOfMonthISO() {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10)
}

export function daysAgoISO(n) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString().slice(0, 10)
}

export function toIT(value) {
  if (!value) return '—'
  const [y, m, d] = String(value).slice(0, 10).split('-')
  return `${d}/${m}/${y}`
}

export function formatDateTime(value) {
  if (!value) return '—'
  return new Date(value).toLocaleString('it-IT', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

// ============ MONEY ============
export function formatMoney(value) {
  return Number(value || 0).toLocaleString('it-IT', {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  })
}

export function formatMoney0(value) {
  return Number(value || 0).toLocaleString('it-IT', { maximumFractionDigits: 0 })
}

export function formatEuro(value) {
  return `${formatMoney(value)} €`
}

export function formatEuro0(value) {
  return `${formatMoney0(value)} €`
}

export function normNumber(v) {
  if (v === '' || v == null) return 0
  const cleaned = String(v).replace(/[^\d.-]/g, '')
  return Number(cleaned) || 0
}

// ============ STRINGS ============
export function initials(name = '') {
  return String(name)
    .split(' ').filter(Boolean).slice(0, 2)
    .map((s) => s[0]?.toUpperCase()).join('') || '·'
}

export function avatarColor(name = '') {
  const colors = [
    'bg-blue-100 text-blue-700',
    'bg-green-100 text-green-700',
    'bg-amber-100 text-amber-700',
    'bg-rose-100 text-rose-700',
    'bg-purple-100 text-purple-700',
    'bg-cyan-100 text-cyan-700',
    'bg-indigo-100 text-indigo-700',
  ]
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0
  return colors[hash % colors.length]
}

// ============ VENUES SORT (K-priority) ============
export function venueSortFn(a, b) {
  const aId = String(a?.id || a?.venue_id || '')
  const bId = String(b?.id || b?.venue_id || '')
  const aLetter = aId.charAt(0), bLetter = bId.charAt(0)
  if (aLetter !== bLetter) {
    if (aLetter === 'K') return -1
    if (bLetter === 'K') return 1
  }
  const aNum = parseInt(aId.replace(/\D/g, ''), 10) || 0
  const bNum = parseInt(bId.replace(/\D/g, ''), 10) || 0
  return aNum - bNum
}

// ============ NAMES ============
export function dipendenteName(d) {
  if (!d) return '—'
  return d.full_name || d.nome_completo || d.display_name || d.nome || d.email || '—'
}

export function dipendenteId(d) {
  if (!d) return ''
  return d.auth_user_id || d.user_id || d.id || ''
}

export function splitName(fullName = '') {
  const parts = String(fullName).trim().split(/\s+/)
  if (parts.length === 0) return { nome: '', cognome: '' }
  if (parts.length === 1) return { nome: parts[0], cognome: '' }
  const nome = parts[0]
  const cognome = parts.slice(1).join(' ')
  return { nome, cognome }
}
