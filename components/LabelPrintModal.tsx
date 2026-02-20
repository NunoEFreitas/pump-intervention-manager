'use client'

import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useTranslations } from 'next-intl'

interface LabelPrintModalProps {
  itemName: string
  partNumber: string
  serialNumbers: string[]
  onClose: () => void
}

// Renders one label sized for Brother QL 62mm × 29mm
function Label({ itemName, partNumber, serialNumber }: {
  itemName: string
  partNumber: string
  serialNumber: string
}) {
  return (
    <div
      className="label-page"
      style={{
        width: '62mm',
        height: '29mm',
        display: 'flex',
        alignItems: 'center',
        gap: '2mm',
        padding: '1.5mm',
        fontFamily: 'Arial, sans-serif',
        background: '#fff',
        boxSizing: 'border-box',
        overflow: 'hidden',
      }}
    >
      {/* Text block */}
      <div style={{ flex: 1, minWidth: 0, overflow: 'hidden', lineHeight: 1.25 }}>
        <div style={{
          fontSize: '7pt',
          fontWeight: 700,
          color: '#000',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          marginBottom: '1mm',
        }}>
          {itemName}
        </div>
        <div style={{ fontSize: '6pt', color: '#555', marginBottom: '1mm' }}>
          {partNumber}
        </div>
        <div style={{
          fontSize: '8pt',
          fontWeight: 700,
          color: '#000',
          fontFamily: 'Courier New, monospace',
          wordBreak: 'break-all',
        }}>
          {serialNumber}
        </div>
      </div>
    </div>
  )
}

export default function LabelPrintModal({ itemName, partNumber, serialNumbers, onClose }: LabelPrintModalProps) {
  const t = useTranslations('warehouse')
  const tCommon = useTranslations('common')
  const printRootRef = useRef<HTMLDivElement | null>(null)

  // Create/reuse a persistent portal root so it survives the modal overlay
  useEffect(() => {
    let el = document.getElementById('label-print-root') as HTMLDivElement | null
    if (!el) {
      el = document.createElement('div')
      el.id = 'label-print-root'
      el.style.display = 'none'
      document.body.appendChild(el)
    }
    printRootRef.current = el
    return () => {
      // Don't remove — it persists for future prints
    }
  }, [])

  const handlePrint = () => {
    window.print()
  }

  const printArea = (
    <div>
      {serialNumbers.map((sn) => (
        <Label key={sn} itemName={itemName} partNumber={partNumber} serialNumber={sn} />
      ))}
    </div>
  )

  return (
    <>
      {/* Inject labels into the persistent print root via portal */}
      {printRootRef.current && createPortal(printArea, printRootRef.current)}

      {/* Preview modal */}
      <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[60] p-4">
        <div className="bg-white rounded-xl shadow-xl w-full max-w-md flex flex-col max-h-[90vh]">
          {/* Header */}
          <div className="p-5 border-b">
            <h2 className="text-lg font-bold text-gray-900">{t('printLabels')}</h2>
            <p className="text-sm text-gray-600 mt-0.5">
              {serialNumbers.length} {serialNumbers.length === 1 ? t('label') : t('labels')} — {itemName}
            </p>
          </div>

          {/* Label previews */}
          <div className="flex-1 overflow-y-auto p-5 space-y-3">
            {serialNumbers.map((sn) => (
              <div
                key={sn}
                className="border-2 border-dashed border-gray-300 rounded-lg overflow-hidden"
                style={{ width: '310px', height: '145px' }}
              >
                {/* Scale from 62mm×29mm → ~310×145px (5× scale) */}
                <div style={{ transform: 'scale(5)', transformOrigin: 'top left', width: '62mm', height: '29mm' }}>
                  <Label itemName={itemName} partNumber={partNumber} serialNumber={sn} />
                </div>
              </div>
            ))}
          </div>

          {/* Actions */}
          <div className="p-5 border-t flex gap-3">
            <button
              onClick={handlePrint}
              className="btn btn-primary flex-1 flex items-center justify-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
              {t('printLabels')}
            </button>
            <button onClick={onClose} className="btn btn-secondary">
              {tCommon('cancel')}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
