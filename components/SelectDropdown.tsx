'use client'

import { useState, useRef, useEffect } from 'react'

interface Option {
  value: string
  label: string
}

interface Props {
  value: string
  options: Option[]
  placeholder?: string
  disabled?: boolean
  onChange: (value: string) => void
}

export default function SelectDropdown({ value, options, placeholder = 'Select...', disabled = false, onChange }: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const selected = options.find(o => o.value === value)

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen(o => !o)}
        className="input text-left flex items-center justify-between disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed"
      >
        <span className={selected?.value ? 'text-gray-800' : 'text-gray-400'}>
          {selected?.value ? selected.label : placeholder}
        </span>
        <svg className="w-4 h-4 text-gray-400 shrink-0 ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <ul
          className="absolute z-50 w-full bg-white border border-gray-300 rounded-lg shadow-lg mt-1 overflow-y-auto"
          style={{ maxHeight: '13rem' }}
        >
          {options.map(opt => (
            <li
              key={opt.value}
              onMouseDown={() => { onChange(opt.value); setOpen(false) }}
              className={`px-3 py-2 cursor-pointer text-sm hover:bg-blue-50 text-gray-800 ${opt.value === value ? 'bg-blue-100 font-medium' : ''}`}
            >
              {opt.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
