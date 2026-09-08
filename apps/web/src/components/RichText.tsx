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
  const withTokens = source
    .replace(/\$\$([\s\S]+?)\$\$/g, (_, tex) => keep(tex, true))
    .replace(/\$([^$\n]+?)\$/g, (_, tex) => keep(tex, false))
  const html = marked.parse(withTokens, { async: false, gfm: true, breaks: false }) as string
  return html.replace(/\u0000M(\d+)\u0000/g, (_, i) => maths[Number(i)] ?? '')
}

export function RichText({ source, className = '', inline = false }: { source: string; className?: string; inline?: boolean }) {
  const html = useMemo(() => {
    const out = renderRichText(source)
    return inline ? out.replace(/^<p>([\s\S]*)<\/p>\s*$/, '$1') : out
  }, [source, inline])
  const Tag = inline ? 'span' : 'div'
  return <Tag className={`rich-text ${className}`} dangerouslySetInnerHTML={{ __html: html }} />
}
