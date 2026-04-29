import React from 'react'
export function Input({ className='', ...props }) {
  return <input className={`w-full rounded-lg bg-zinc-900 border border-zinc-800 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition ${className}`} {...props} />
}
export default Input
