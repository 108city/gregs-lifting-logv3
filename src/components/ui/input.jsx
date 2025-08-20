
import React from 'react'
export function Input({ className='', ...props }) {
  return <input className={`w-full rounded-xl bg-zinc-950 border border-zinc-800 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-600 ${className}`} {...props} />
}
export default Input
