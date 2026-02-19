import { jsPDF } from 'jspdf'
import type { ResumeData } from '@/lib/profile'
import { linkUrls } from '@/lib/profile'
import type { TemplateId } from '@/app/components/ResumePreview'

const MARGIN = 20
const PAGE_W = 210
const PAGE_H = 297
const CONTENT_W = PAGE_W - MARGIN * 2

export function exportResumeToPdf(
  data: ResumeData,
  filename = 'resume.pdf',
  templateId: TemplateId = 'classic'
) {
  if (templateId === 'compact') {
    exportCompactPdf(data, filename)
    return
  }
  exportClassicPdf(data, filename)
}

function exportClassicPdf(data: ResumeData, filename: string) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  let y = MARGIN

  if (data.identity.name) {
    doc.setFontSize(18)
    doc.setFont('helvetica', 'bold')
    doc.text(data.identity.name, MARGIN, y)
    y += 10
  }
  const contact = [data.identity.email, data.identity.phone, data.identity.location, ...linkUrls(data.identity.links || [])]
    .filter(Boolean)
    .join('  •  ')
  if (contact) {
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    const contactLines = doc.splitTextToSize(contact, CONTENT_W)
    contactLines.forEach((line: string) => {
      doc.text(line, MARGIN, y)
      y += 5
    })
  }
  y += 4
  if (data.summary) {
    doc.setFontSize(11)
    doc.setFont('helvetica', 'bold')
    doc.text('Summary', MARGIN, y)
    y += 6
    doc.setFont('helvetica', 'normal')
    const summaryLines = doc.splitTextToSize(data.summary, CONTENT_W)
    summaryLines.forEach((line: string) => {
      doc.text(line, MARGIN, y)
      y += 5
    })
    y += 4
  }
  if (data.experience?.length) {
    doc.setFontSize(11)
    doc.setFont('helvetica', 'bold')
    doc.text('Experience', MARGIN, y)
    y += 8
    doc.setFont('helvetica', 'normal')
    for (const exp of data.experience) {
      const title = [exp.title, exp.company].filter(Boolean).join(' — ')
      if (title) {
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(10)
        doc.text(title, MARGIN, y)
        y += 5
      }
      if (exp.dates) {
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(9)
        doc.text(exp.dates, MARGIN, y)
        y += 5
      }
      if (exp.bullets?.length) {
        for (const bullet of exp.bullets) {
          const text = typeof bullet === 'string' ? bullet : bullet.text
          if (!text?.trim()) continue
          const bulletLines = doc.splitTextToSize('• ' + text.trim(), CONTENT_W - 6)
          bulletLines.forEach((line: string) => {
            if (y > PAGE_H - MARGIN) {
              doc.addPage()
              y = MARGIN
            }
            doc.text(line, MARGIN + 3, y)
            y += 4
          })
        }
      }
      y += 4
    }
  }
  if (data.skills?.length) {
    doc.setFontSize(11)
    doc.setFont('helvetica', 'bold')
    doc.text('Skills', MARGIN, y)
    y += 6
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    const skillLines = doc.splitTextToSize(
      data.skills.map((s) => (typeof s === 'string' ? s : s.name)).join(', '),
      CONTENT_W
    )
    skillLines.forEach((line: string) => {
      doc.text(line, MARGIN, y)
      y += 5
    })
    y += 4
  }
  const languages = (data as any).languages as Array<{ language: string; level: string }> | undefined
  if (languages?.length) {
    doc.setFontSize(11)
    doc.setFont('helvetica', 'bold')
    doc.text('Languages', MARGIN, y)
    y += 6
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    const langStr = languages.map((l) => `${l.language}${l.level ? ` (${l.level})` : ''}`).join(', ')
    const langLines = doc.splitTextToSize(langStr, CONTENT_W)
    langLines.forEach((line: string) => {
      doc.text(line, MARGIN, y)
      y += 5
    })
    y += 4
  }
  const additional = (data as any).additional as Array<{ title: string; content: string[] }> | undefined
  if (additional?.length) {
    for (const sec of additional) {
      if (!sec.title && !sec.content?.length) continue
      doc.setFontSize(11)
      doc.setFont('helvetica', 'bold')
      doc.text(sec.title || 'Additional', MARGIN, y)
      y += 6
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(10)
      for (const item of sec.content ?? []) {
        if (!item?.trim()) continue
        const lines = doc.splitTextToSize('• ' + item.trim(), CONTENT_W - 6)
        lines.forEach((line: string) => {
          if (y > PAGE_H - MARGIN) {
            doc.addPage()
            y = MARGIN
          }
          doc.text(line, MARGIN + 3, y)
          y += 4
        })
      }
      y += 4
    }
  }
  doc.save(filename)
}

function exportCompactPdf(data: ResumeData, filename: string) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const colLeft = 50
  const mainLeft = 55
  const mainW = PAGE_W - mainLeft - MARGIN
  let yMain = MARGIN
  let ySide = MARGIN

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  if (data.identity.name) {
    doc.text(data.identity.name, MARGIN, ySide)
    ySide += 8
  }
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  const contact = [data.identity.email, data.identity.phone, data.identity.location, ...linkUrls(data.identity.links || [])]
    .filter(Boolean)
    .join(' · ')
  if (contact) {
    const contactLines = doc.splitTextToSize(contact, colLeft - MARGIN - 4)
    contactLines.forEach((line: string) => {
      doc.text(line, MARGIN, ySide)
      ySide += 4
    })
  }
  ySide += 6
  if (data.skills?.length) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.text('Skills', MARGIN, ySide)
    ySide += 5
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    const skillLines = doc.splitTextToSize(
      data.skills.map((s) => (typeof s === 'string' ? s : s.name)).join(', '),
      colLeft - MARGIN - 4
    )
    skillLines.forEach((line: string) => {
      doc.text(line, MARGIN, ySide)
      ySide += 4
    })
  }

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  if (data.summary) {
    doc.text('Summary', mainLeft, yMain)
    yMain += 6
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    const summaryLines = doc.splitTextToSize(data.summary, mainW)
    summaryLines.forEach((line: string) => {
      doc.text(line, mainLeft, yMain)
      yMain += 4
    })
    yMain += 4
  }
  if (data.experience?.length) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.text('Experience', mainLeft, yMain)
    yMain += 8
    doc.setFont('helvetica', 'normal')
    for (const exp of data.experience) {
      const title = [exp.title, exp.company].filter(Boolean).join(' — ')
      if (title) {
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(9)
        doc.text(title, mainLeft, yMain)
        yMain += 4
      }
      if (exp.dates) {
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(8)
        doc.text(exp.dates, mainLeft, yMain)
        yMain += 4
      }
      if (exp.bullets?.length) {
        for (const bullet of exp.bullets) {
          const text = typeof bullet === 'string' ? bullet : bullet.text
          if (!text?.trim()) continue
          const bulletLines = doc.splitTextToSize('• ' + text.trim(), mainW - 4)
          bulletLines.forEach((line: string) => {
            if (yMain > PAGE_H - MARGIN) {
              doc.addPage()
              yMain = MARGIN
            }
            doc.text(line, mainLeft + 2, yMain)
            yMain += 3.5
          })
        }
      }
      yMain += 3
    }
  }
  const languages = (data as any).languages as Array<{ language: string; level: string }> | undefined
  if (languages?.length) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.text('Languages', mainLeft, yMain)
    yMain += 6
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    const langStr = languages.map((l) => `${l.language}${l.level ? ` (${l.level})` : ''}`).join(', ')
    const langLines = doc.splitTextToSize(langStr, mainW)
    langLines.forEach((line: string) => {
      doc.text(line, mainLeft, yMain)
      yMain += 4
    })
    yMain += 4
  }
  const additional = (data as any).additional as Array<{ title: string; content: string[] }> | undefined
  if (additional?.length) {
    for (const sec of additional) {
      if (!sec.title && !sec.content?.length) continue
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(10)
      doc.text(sec.title || 'Additional', mainLeft, yMain)
      yMain += 6
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9)
      for (const item of sec.content ?? []) {
        if (!item?.trim()) continue
        const lines = doc.splitTextToSize('• ' + item.trim(), mainW - 4)
        lines.forEach((line: string) => {
          if (yMain > PAGE_H - MARGIN) {
            doc.addPage()
            yMain = MARGIN
          }
          doc.text(line, mainLeft + 2, yMain)
          yMain += 3.5
        })
      }
      yMain += 3
    }
  }
  doc.save(filename)
}
