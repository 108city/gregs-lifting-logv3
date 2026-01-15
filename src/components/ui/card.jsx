import React from 'react'

export function Card({ children, className = '' }) {
  return <div className={`bg-zinc-900/60 border border-zinc-800 rounded-2xl ${className}`}>{children}</div>
}

export function CardHeader({ children, className = '' }) {
  return <div className={`p-6 ${className}`}>{children}</div>
}

export function CardTitle({ children, className = '' }) {
  return <h3 className={`text-2xl font-semibold leading-none tracking-tight ${className}`}>{children}</h3>
}

export function CardDescription({ children, className = '' }) {
  return <p className={`text-sm text-zinc-400 ${className}`}>{children}</p>
}

export function CardContent({ children, className = '' }) {
  return <div className={`p-6 pt-0 ${className}`}>{children}</div>
}

export function CardFooter({ children, className = '' }) {
  return <div className={`flex items-center p-6 pt-0 ${className}`}>{children}</div>
}

export default Card
