
import React from 'react'
export function Button({ children, variant='default', size='default', className='', ...props }) {
  const base = 'inline-flex items-center justify-center rounded-2xl px-3 py-2 text-sm font-medium shadow-sm transition'
  const variants = {
    default: 'bg-blue-600 text-white hover:bg-blue-500',
    outline: 'border border-blue-400 text-blue-400 hover:bg-blue-950',
    ghost: 'text-blue-400 hover:bg-blue-950',
    destructive: 'bg-red-600 text-white hover:bg-red-500'
  }
  const sizes = { sm: 'px-2 py-1 text-xs', default: '', lg: 'px-4 py-3 text-base'}
  return <button className={`${base} ${variants[variant]||variants.default} ${sizes[size]||''} ${className}`} {...props}>{children}</button>
}
export default Button
