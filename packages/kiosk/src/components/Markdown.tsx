import { Fragment, type ReactNode } from 'react'

/** Tiny safe-markdown renderer for admin-managed copy.
 *
 *  Intentional subset:
 *   - blank line separates blocks
 *   - lines starting with `## ` become an <h3>
 *   - consecutive lines starting with `- ` become a <ul>
 *   - everything else is a <p>
 *
 *  Inline:
 *   - `**bold**` → <strong>
 *
 *  HTML in source is treated as plain text (escaped by React text nodes), so
 *  no XSS even if an admin pastes raw `<script>` tags. No links / images /
 *  tables on purpose — we control the input and this stays predictable. */

function renderInline(text: string, keyPrefix: string): ReactNode[] {
  // Split on **bold** while preserving the markers' positions.
  const parts = text.split(/(\*\*[^*]+\*\*)/g)
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      return (
        <strong key={`${keyPrefix}-b-${i}`} className="font-bold text-el-light">
          {part.slice(2, -2)}
        </strong>
      )
    }
    return <Fragment key={`${keyPrefix}-t-${i}`}>{part}</Fragment>
  })
}

export function Markdown({ source, className = '' }: { source: string; className?: string }) {
  if (!source) return null

  const lines = source.replace(/\r\n/g, '\n').split('\n')
  const blocks: ReactNode[] = []
  let i = 0
  let buf: string[] = []

  const flushParagraph = () => {
    if (buf.length === 0) return
    const text = buf.join(' ')
    blocks.push(
      <p key={`p-${blocks.length}`} className="leading-relaxed">
        {renderInline(text, `p${blocks.length}`)}
      </p>,
    )
    buf = []
  }

  while (i < lines.length) {
    const line = lines[i]
    const trimmed = line.trim()

    if (trimmed === '') {
      flushParagraph()
      i++
      continue
    }

    if (trimmed.startsWith('## ')) {
      flushParagraph()
      blocks.push(
        <h3
          key={`h-${blocks.length}`}
          className="text-base sm:text-lg font-bold text-el-light mt-1"
        >
          {renderInline(trimmed.slice(3), `h${blocks.length}`)}
        </h3>,
      )
      i++
      continue
    }

    if (trimmed.startsWith('- ')) {
      flushParagraph()
      const items: string[] = []
      while (i < lines.length && lines[i].trim().startsWith('- ')) {
        items.push(lines[i].trim().slice(2))
        i++
      }
      blocks.push(
        <ul key={`u-${blocks.length}`} className="list-disc pl-5 space-y-1">
          {items.map((it, j) => (
            <li key={`u-${blocks.length}-${j}`}>{renderInline(it, `ul${blocks.length}-${j}`)}</li>
          ))}
        </ul>,
      )
      continue
    }

    buf.push(trimmed)
    i++
  }
  flushParagraph()

  return <div className={`space-y-3 ${className}`}>{blocks}</div>
}
