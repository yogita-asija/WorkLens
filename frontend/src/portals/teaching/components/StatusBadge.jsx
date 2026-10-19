import React from 'react'

const STATUS_CONFIG = {
  present: {
    label: 'Present',
    dot: 'bg-green-400',
    text: 'text-green-400',
    bg: 'bg-green-400/10',
    border: 'border-green-400/25',
  },
  absent: {
    label: 'Absent',
    dot: 'bg-red-400',
    text: 'text-red-400',
    bg: 'bg-red-400/10',
    border: 'border-red-400/25',
  },
  late: {
    label: 'Late',
    dot: 'bg-yellow-400',
    text: 'text-yellow-400',
    bg: 'bg-yellow-400/10',
    border: 'border-yellow-400/25',
  },
}

/**
 * StatusBadge
 * @param {'present'|'absent'|'late'} status
 * @param {'sm'|'md'} size
 */
export default function StatusBadge({ status, size = 'md' }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.absent

  const sizeClasses = size === 'sm'
    ? 'text-[10px] px-2 py-0.5 gap-1'
    : 'text-xs px-2.5 py-1 gap-1.5'

  return (
    <span
      className={`
        inline-flex items-center font-semibold rounded-full border
        ${cfg.bg} ${cfg.text} ${cfg.border}
        ${sizeClasses}
        transition-all duration-200
      `}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot} animate-pulse-dot`} />
      {cfg.label}
    </span>
  )
}
