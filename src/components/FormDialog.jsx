import { useEffect, useState } from 'react'
import { Modal, Button, Input, Select, Field, Textarea } from './ui'

export function FormDialog({
  open, onClose, title, fields = [],
  initialValues = {}, submitLabel = 'Salva',
  onSubmit, width = 'md',
}) {
  const [values, setValues] = useState({})
  const [errors, setErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [globalError, setGlobalError] = useState('')

  useEffect(() => {
    if (!open) return
    const init = {}
    fields.forEach((f) => {
      const k = f.name
      if (initialValues && initialValues[k] !== undefined && initialValues[k] !== null) init[k] = initialValues[k]
      else if (f.defaultValue !== undefined) init[k] = f.defaultValue
      else init[k] = ''
    })
    setValues(init)
    setErrors({})
    setGlobalError('')
  }, [open])

  function setVal(name, value) {
    setValues((p) => ({ ...p, [name]: value }))
    setErrors((p) => ({ ...p, [name]: undefined }))
  }

  function validate() {
    const next = {}
    fields.forEach((f) => {
      const v = values[f.name]
      if (f.required && (v === '' || v == null)) next[f.name] = 'Campo obbligatorio'
      if (v && f.pattern) {
        const re = new RegExp(f.pattern)
        if (!re.test(String(v))) next[f.name] = f.patternError || 'Formato non valido'
      }
    })
    setErrors(next)
    return Object.keys(next).length === 0
  }

  async function handleSubmit() {
    if (!validate()) return
    try {
      setSubmitting(true)
      setGlobalError('')
      const cleaned = { ...values }
      fields.forEach((f) => { if (f.autoUpper && cleaned[f.name]) cleaned[f.name] = String(cleaned[f.name]).toUpperCase() })
      await onSubmit(cleaned)
    } catch (e) {
      setGlobalError(e?.message || 'Errore')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      open={open} onClose={onClose} title={title} width={width}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={submitting}>Annulla</Button>
          <Button variant="primary" onClick={handleSubmit} disabled={submitting}>
            {submitting ? 'Salvando…' : submitLabel}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        {globalError && (
          <div className="rounded-md border border-[var(--color-danger-border)] bg-[var(--color-danger-soft)] px-3 py-2 text-[12px] text-[var(--color-danger)]">
            {globalError}
          </div>
        )}
        {fields.map((f) => (
          <Field
            key={f.name}
            label={f.label}
            hint={f.hint}
            error={errors[f.name]}
            required={f.required}
          >
            {f.type === 'select' ? (
              <Select value={values[f.name] ?? ''} onChange={(e) => setVal(f.name, e.target.value)}>
                {!f.required && <option value="">— Seleziona —</option>}
                {f.options?.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </Select>
            ) : f.type === 'textarea' ? (
              <Textarea
                rows={f.rows || 3}
                value={values[f.name] ?? ''}
                onChange={(e) => setVal(f.name, e.target.value)}
                placeholder={f.placeholder || ''}
              />
            ) : (
              <Input
                type={f.type || 'text'}
                value={values[f.name] ?? ''}
                onChange={(e) => {
                  let v = e.target.value
                  if (f.autoUpper) v = v.toUpperCase()
                  setVal(f.name, v)
                }}
                placeholder={f.placeholder || ''}
                autoComplete="off"
              />
            )}
          </Field>
        ))}
      </div>
    </Modal>
  )
}

export function ConfirmDialog({
  open, onClose, title, message,
  confirmLabel = 'Conferma', variant = 'danger',
  onConfirm,
}) {
  const [submitting, setSubmitting] = useState(false)
  const [err, setErr] = useState('')

  async function go() {
    try {
      setSubmitting(true); setErr('')
      await onConfirm()
    } catch (e) {
      setErr(e?.message || 'Errore')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      open={open} onClose={onClose} title={title} width="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={submitting}>Annulla</Button>
          <Button variant={variant} onClick={go} disabled={submitting}>
            {submitting ? 'Attendi…' : confirmLabel}
          </Button>
        </>
      }
    >
      <p className="text-[13px] text-[var(--color-text-secondary)]">{message}</p>
      {err && (
        <p className="mt-3 rounded-md border border-[var(--color-danger-border)] bg-[var(--color-danger-soft)] px-3 py-2 text-[12px] text-[var(--color-danger)]">
          {err}
        </p>
      )}
    </Modal>
  )
}
