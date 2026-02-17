import { jsPDF } from 'jspdf'

const MARGIN = 20
const PAGE_W = 210
const PAGE_H = 297
const CONTENT_W = PAGE_W - MARGIN * 2

export function exportCoverLetterToPdf(text: string, filename = 'cover-letter.pdf') {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  let y = MARGIN

  const paragraphs = text.split(/\n\s*\n/)

  for (const para of paragraphs) {
    const trimmed = para.trim()
    if (!trimmed) continue

    doc.setFontSize(11)
    doc.setFont('helvetica', 'normal')
    const lines = doc.splitTextToSize(trimmed, CONTENT_W)

    for (const line of lines) {
      if (y > PAGE_H - MARGIN) {
        doc.addPage()
        y = MARGIN
      }
      doc.text(line, MARGIN, y)
      y += 5
    }

    y += 4
  }

  doc.save(filename)
}
