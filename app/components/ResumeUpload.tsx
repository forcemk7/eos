'use client'

import { useState, useRef } from 'react'

interface ResumeUploadProps {
  onSuccess: () => void
}

export default function ResumeUpload({ onSuccess }: ResumeUploadProps) {
  const [status, setStatus] = useState('')
  const [error, setError] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function uploadFile(file: File) {
    if (!file) return

    const formData = new FormData()
    formData.append('file', file)

    setStatus('Parsing your resume…')
    setError(false)

    try {
      const parseRes = await fetch('/api/parse-resume', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      })
      const parseData = await parseRes.json()

      if (!parseRes.ok || !parseData.success) {
        throw new Error(parseData.error || 'Failed to parse resume.')
      }

      setStatus('Saving first version…')

      const saveRes = await fetch('/api/resume', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          parsed: parseData.parsed,
          rawText: parseData.rawText || '',
          fileName: parseData.fileName || file.name,
          storagePath: parseData.storagePath ?? null,
        }),
        credentials: 'include',
      })

      const saveData = await saveRes.json()
      if (!saveRes.ok || !saveData.success) {
        throw new Error(saveData.error || 'Failed to save.')
      }

      setStatus('Done.')
      onSuccess()
    } catch (err: any) {
      setStatus(err.message || 'Something went wrong.')
      setError(true)
    }
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file) uploadFile(file)
  }

  return (
    <div className="resume-first">
      <h1 className="resume-first-title">Your resume, in the cloud</h1>
      <p className="resume-first-subtitle">
        Upload once to get started. We’ll turn it into an editable, versioned doc — manage it here and export to PDF whenever you need a file.
      </p>

      <div
        role="button"
        tabIndex={0}
        className={`resume-dropzone ${dragOver ? 'drag-over' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        onClick={() => fileInputRef.current?.click()}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInputRef.current?.click() } }}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          onChange={(e) => e.target.files?.[0] && uploadFile(e.target.files[0])}
          className="resume-file-input-hidden"
          aria-hidden
        />
        <p className="dropzone-title">Drop your resume here</p>
        <p className="dropzone-subtitle">or click to choose PDF or DOCX</p>
      </div>

      {status && (
        <p className={`resume-upload-status ${error ? 'error' : ''}`}>{status}</p>
      )}
    </div>
  )
}
