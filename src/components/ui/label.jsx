
import React from 'react'
export function Label({ className='', children }) {
  return <label className={`block text-xs uppercase tracking-wide text-zinc-300 ${className}`}>{children}</label>
}
export default Label
