import React from 'react'
export function Button({ children, variant='default', size='default', className='', ...props }) {
  const base = 'inline-flex items-center justify-center rounded-xl px-3 py-2 text-sm font-medium transition active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none'
  const variants = {
    default: 'bg-emerald-500 text-zinc-950 hover:bg-emerald-400 shadow-sm shadow-emerald-900/30',
    outline: 'border border-zinc-700 text-zinc-100 hover:bg-zinc-800 hover:border-zinc-600',
    ghost: 'text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100',
    destructive: 'bg-red-600 text-white hover:bg-red-500',
    link: 'text-emerald-400 hover:text-emerald-300 underline-offset-4 hover:underline'
  }
  const sizes = { sm: 'px-2.5 py-1.5 text-xs rounded-lg', default: '', lg: 'px-5 py-3 text-base rounded-xl', icon: 'h-9 w-9 p-0' }
  return <button className={`${base} ${variants[variant]||variants.default} ${sizes[size]||''} ${className}`} {...props}>{children}</button>
}
export default Button
