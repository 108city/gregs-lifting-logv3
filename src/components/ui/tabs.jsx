
import React, { createContext, useContext } from 'react'
const TabsCtx = createContext({ value: '', onChange: () => {} })

export function Tabs({ value, onValueChange, children }) {
  return <TabsCtx.Provider value={{ value, onChange: onValueChange }}>{children}</TabsCtx.Provider>
}
export function TabsList({ children, className='' }) {
  return <div className={`inline-flex gap-2 p-1 rounded-xl ${className}`}>{children}</div>
}
export function TabsTrigger({ value, children }) {
  const ctx = useContext(TabsCtx)
  const active = ctx.value === value
  return (
    <button
      onClick={() => ctx.onChange && ctx.onChange(value)}
      className={`px-3 py-1.5 rounded-lg text-sm ${active ? 'bg-blue-600 text-white' : 'bg-zinc-800 text-zinc-300'}`}
      aria-selected={active}
      role="tab"
    >
      {children}
    </button>
  )
}
export function TabsContent({ value, children }) {
  const ctx = useContext(TabsCtx)
  return ctx.value === value ? <div className="mt-3">{children}</div> : null
}
export default Tabs
