import katex from 'katex'
import { marked } from 'marked'
import { useMemo } from 'react'

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
  const html = marked.parse(withTokens, { async: false, gfm: true, breaks: false }) as string
  return (
    html
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
  return <Tag className={`rich-text ${className}`} dangerouslySetInnerHTML={{ __html: html }} />
}
