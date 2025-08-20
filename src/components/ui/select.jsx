
import React from 'react'

export function Select({ value, onValueChange, children }) {
  const items = []
  React.Children.forEach(children, ch => {
    if (ch && ch.type && ch.type.__type === 'SelectContent') {
      React.Children.forEach(ch.props.children, item => {
        if (item && item.type && item.type.__type === 'SelectItem') {
          items.push({ value: item.props.value, label: item.props.children })
        }
      })
    }
  })
  return (
    <select
      className="w-full rounded-xl bg-zinc-950 border border-zinc-800 px-3 py-2 text-sm text-white"
      value={value ?? ''}
      onChange={(e) => onValueChange && onValueChange(e.target.value)}
    >
      {items.length === 0 ? <option value="">—</option> : null}
      {items.map((it, i) => (
        <option key={i} value={it.value}>{it.label}</option>
      ))}
    </select>
  )
}
export function SelectTrigger({ children }) { return <div className="hidden">{children}</div> }
SelectTrigger.__type = 'SelectTrigger'

export function SelectValue({ placeholder }) { return <span className="hidden">{placeholder}</span> }
SelectValue.__type = 'SelectValue'

export function SelectContent({ children }) { return <div className="hidden">{children}</div> }
SelectContent.__type = 'SelectContent'

export function SelectItem({ value, children }) { return <div className="hidden" data-value={value}>{children}</div> }
SelectItem.__type = 'SelectItem'

export default Select
