
import React from 'react'
export function Card({ children, className='' }) {
  return <div className={`bg-zinc-900/60 border border-zinc-800 rounded-2xl ${className}`}>{children}</div>
}
export default Card
