'use client'

import { useState, useRef } from 'react'
import { AppShell, AppPageHeader } from '@/app/components/shell'
import { cn } from '@/lib/utils'

interface ResumeUploadProps {
  onSuccess: () => void
}

type UploadPhase = 'idle' | 'parse' | 'save' | 'done'

export default function ResumeUpload({ onSuccess }: ResumeUploadProps) {
  const [uploadPhase, setUploadPhase] = useState<UploadPhase>('idle')
  const [activeFileName, setActiveFileName] = useState<string | null>(null)
  const [statusDetail, setStatusDetail] = useState('')
  const [error, setError] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function uploadFile(file: File) {
    if (!file) return

    const formData = new FormData()
    formData.append('file', file)

    setActiveFileName(file.name)
    setUploadPhase('parse')
    setStatusDetail('Extracting text and structuring your resume…')
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

      setUploadPhase('save')
      setStatusDetail('Writing your first version to the workspace…')

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

      setUploadPhase('done')
      setStatusDetail(`Saved “${parseData.fileName || file.name}” — opening the editor…`)
      requestAnimationFrame(() => {
        onSuccess()
      })
    } catch (err: unknown) {
      setUploadPhase('idle')
      setActiveFileName(null)
      setStatusDetail(err instanceof Error ? err.message : 'Something went wrong.')
      setError(true)
    }
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file) uploadFile(file)
  }

  const showStepper = activeFileName !== null || uploadPhase !== 'idle'

  return (
    <AppShell>
      <div className="resume-first mx-auto w-full max-w-lg">
        <AppPageHeader
          as="h1"
          variant="section"
          title="Your resume, in the cloud"
          description="Upload once to get started. We’ll turn it into an editable, versioned doc — manage it here and export to PDF whenever you need a file."
        />

        <div
          role="button"
          tabIndex={0}
          className={`resume-dropzone ${dragOver ? 'drag-over' : ''}`}
          onDragOver={(e) => {
            e.preventDefault()
            setDragOver(true)
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          onClick={() => fileInputRef.current?.click()}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              fileInputRef.current?.click()
            }
          }}
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

        {showStepper && (
          <ol className="resume-upload-steps" aria-label="Upload progress">
            <li
              className={cn(
                'resume-upload-step',
                uploadPhase !== 'idle' && 'resume-upload-step--done'
              )}
            >
              <span className="resume-upload-step-num">1</span>
              <span className="resume-upload-step-label">
                Upload
                {activeFileName ? (
                  <span className="resume-upload-step-file" title={activeFileName}>
                    {' '}
                    · {activeFileName}
                  </span>
                ) : null}
              </span>
            </li>
            <li
              className={cn(
                'resume-upload-step',
                (uploadPhase === 'save' || uploadPhase === 'done') && 'resume-upload-step--done',
                uploadPhase === 'parse' && 'resume-upload-step--active'
              )}
            >
              <span className="resume-upload-step-num">2</span>
              <span className="resume-upload-step-label">Parse</span>
            </li>
            <li
              className={cn(
                'resume-upload-step',
                uploadPhase === 'done' && 'resume-upload-step--done',
                uploadPhase === 'save' && 'resume-upload-step--active'
              )}
            >
              <span className="resume-upload-step-num">3</span>
              <span className="resume-upload-step-label">Save to workspace</span>
            </li>
          </ol>
        )}

        {(statusDetail || error) && (
          <div
            role="status"
            aria-live="polite"
            aria-atomic="true"
            className={cn('resume-upload-status', error && 'error')}
          >
            {statusDetail}
          </div>
        )}
      </div>
    </AppShell>
  )
}
