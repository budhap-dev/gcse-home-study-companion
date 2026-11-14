import katex from 'katex'
import { marked } from 'marked'
import { useEffect, useMemo, useRef } from 'react'
import { drawHands } from './hand.ts'

/**
 * Markdown with $inline$ and $$display$$ maths. Maths is rendered by KaTeX first and
 * swapped in after Markdown runs, so Markdown never sees backslashes or underscores.
 * Content comes from the repository's own pack, so it is trusted HTML.
 */
export function renderRichText(source: string): string {
  const maths: string[] = []
  const keep = (tex: string, display: boolean) => {
    maths.push(katex.renderToString(tex, { displayMode: display, throwOnError: false, output: 'html' }))
    return `\u0000M${maths.length - 1}\u0000`
  }
  // A backslash-escaped dollar is currency, not a maths delimiter: the Business
  // exchange-rate questions price a machine at \$12 000. It is parked as a token so
  // neither the maths pass nor Markdown sees it, and put back at the end.
  const withTokens = source
    .replace(/\\\$/g, '\u0000D\u0000')
    .replace(/\$\$([\s\S]+?)\$\$/g, (_, tex) => keep(tex, true))
    .replace(/\$([^$\n]+?)\$/g, (_, tex) => keep(tex, false))
    // Hand-drawn marks (section 15, Part C): {{circle|word}}, {{underline|a sentence}},
    // {{highlight|a formula}}. Read after the maths is parked, so TeX braces never match. A
    // circled word is bold and a highlight is a <mark>, so the emphasis is there without
    // the drawing; hand.ts draws over them. An unknown kind is left as written for the
    // content tests to catch.
    .replace(/\{\{(circle|underline|highlight)\|([^{}]+?)\}\}/g, (_, kind: string, text: string) =>
      kind === 'circle' ? `<span class="hand hand-circle" data-hand="circle"><strong>${text}</strong></span>`
        : kind === 'highlight' ? `<mark class="hand hand-highlight" data-hand="highlight">${text}</mark>`
          : `<span class="hand hand-underline" data-hand="underline">${text}</span>`)
  const html = marked.parse(withTokens, { async: false, gfm: true, breaks: false }) as string
  return (
    html
      // A full stop, comma or bracket written hard against maths belongs to it, but the
      // browser sees a box and then a character and will end the line between them: a
      // sentence ending "add to 180°." left its full stop alone at the start of the next
      // line. Glued, the pair moves together; the maths can still break inside itself.
      .replace(/([(\[“‘]?)\u0000M(\d+)\u0000([.,;:!?)\]”’]*)/g, (whole, before: string, i: string, after: string) => {
        const tex = maths[Number(i)] ?? ''
        if ((!before && !after) || tex.includes('katex-display')) return whole
        return `<span class="maths-glue">${before}\u0000M${i}\u0000${after}</span>`
      })
      .replace(/\u0000M(\d+)\u0000/g, (_, i) => maths[Number(i)] ?? '')
      .replace(/\u0000D\u0000/g, () => '$')
      // A wide table has to scroll rather than push the page sideways on a phone, and
      // marked emits a bare <table>, so the scroll container is added here.
      .replace(/<table>/g, '<div class="rich-table"><table>')
      .replace(/<\/table>/g, '</table></div>')
  )
}

export function RichText({ source, className = '', inline = false }: { source: string; className?: string; inline?: boolean }) {
  const html = useMemo(() => {
    const out = renderRichText(source)
    return inline ? out.replace(/^<p>([\s\S]*)<\/p>\s*$/, '$1') : out
  }, [source, inline])
  const Tag = inline ? 'span' : 'div'
  const ref = useRef<HTMLElement>(null)
  useEffect(() => (ref.current && html.includes('data-hand') ? drawHands(ref.current) : undefined), [html])
  return <Tag ref={ref as never} className={`rich-text ${className}`} dangerouslySetInnerHTML={{ __html: html }} />
}
