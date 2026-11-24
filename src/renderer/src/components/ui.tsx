import { useEffect, useRef, type ButtonHTMLAttributes, type ReactNode } from 'react'

export function Button({ children, variant = 'secondary', className = '', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & {variant?: 'primary'|'secondary'|'ghost'}) {
  return <button type="button" {...props} className={`button button--${variant} ${className}`}>{children}</button>
}
export function Panel({ title, detail, action, children, className = '' }: {title: string; detail?: string; action?: ReactNode; children: ReactNode; className?: string}) {
  return <section className={`panel ${className}`}><header className="panel-heading"><div><h2>{title}</h2>{detail && <p>{detail}</p>}</div>{action}</header>{children}</section>
}
export function Status({ children, tone = 'neutral' }: {children: ReactNode; tone?: 'neutral'|'ready'|'warning'}) {
  return <span className={`status status--${tone}`}><span className="status-dot" aria-hidden="true"/>{children}</span>
}
export function Empty({ title, children }: {title: string; children: ReactNode}) {
  return <div className="empty"><div className="empty-mark" aria-hidden="true">◇</div><h3>{title}</h3><p>{children}</p></div>
}
export function ConfirmDialog({ title, children, onClose, onConfirm }: {title: string; children: ReactNode; onClose: () => void; onConfirm: () => void}) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const dialog = ref.current
    const previous = document.activeElement
    if (dialog && !dialog.open) dialog.showModal()
    return () => { if (dialog?.open) dialog.close(); if (previous instanceof HTMLElement) previous.focus() }
  }, [])
  return <dialog ref={ref} className="dialog" aria-labelledby="confirm-title" onCancel={e=>{e.preventDefault();onClose()}}>
    <h2 id="confirm-title">{title}</h2><div className="dialog-body">{children}</div>
    <div className="dialog-actions"><Button autoFocus onClick={onClose}>Anuluj</Button><Button variant="primary" onClick={onConfirm}>Przywróć</Button></div>
  </dialog>
}
