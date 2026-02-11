import { jsPDF } from 'jspdf'
import type { ResumeData } from '@/app/components/ResumeEditor'

const MARGIN = 20
const PAGE_W = 210
const PAGE_H = 297
const CONTENT_W = PAGE_W - MARGIN * 2

export function exportResumeToPdf(data: ResumeData, filename = 'resume.pdf') {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  let y = MARGIN
  const lineHeight = 5
  const smallLine = 4

  function nextLine(n = 1) {
    y += lineHeight * n
    if (y > PAGE_H - MARGIN) {
      doc.addPage()
      y = MARGIN
    }
  }

  function drawText(text: string, size: number, bold = false) {
    doc.setFontSize(size)
    doc.setFont('helvetica', bold ? 'bold' : 'normal')
    const lines = doc.splitTextToSize(text, CONTENT_W)
    lines.forEach((line: string) => {
      if (y > PAGE_H - MARGIN) {
        doc.addPage()
        y = MARGIN
      }
      doc.text(line, MARGIN, y)
      y += size * 0.35
    })
  }

  // Name
  if (data.identity.name) {
    doc.setFontSize(18)
    doc.setFont('helvetica', 'bold')
    doc.text(data.identity.name, MARGIN, y)
    y += 10
  }

  // Contact line
  const contact = [data.identity.email, data.identity.location, ...(data.identity.links || [])]
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

  // Summary
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

  // Experience
  if (data.experience?.length) {
    doc.setFontSize(11)
    doc.setFont('helvetica', 'bold')
    doc.text('Experience', MARGIN, y)
    y += 8
    doc.setFont('helvetica', 'normal')
    for (const exp of data.experience) {
      const title = [exp.title, exp.company].filter(Boolean).join(' — ')
      const dates = exp.dates || ''
      if (title) {
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(10)
        doc.text(title, MARGIN, y)
        y += 5
      }
      if (dates) {
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(9)
        doc.text(dates, MARGIN, y)
        y += 5
      }
      if (exp.bullets?.length) {
        for (const bullet of exp.bullets) {
          if (!bullet?.trim()) continue
          const bulletLines = doc.splitTextToSize('• ' + bullet.trim(), CONTENT_W - 6)
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

  // Skills
  if (data.skills?.length) {
    doc.setFontSize(11)
    doc.setFont('helvetica', 'bold')
    doc.text('Skills', MARGIN, y)
    y += 6
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    const skillsStr = data.skills.join(', ')
    const skillLines = doc.splitTextToSize(skillsStr, CONTENT_W)
    skillLines.forEach((line: string) => {
      doc.text(line, MARGIN, y)
      y += 5
    })
  }

  doc.save(filename)
}
