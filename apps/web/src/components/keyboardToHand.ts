/**
 * Whether a page may put the cursor in a field as it opens.
 *
 * With a mouse or a trackpad there is a keyboard under the reader's hands, and a search
 * field that is ready to type into saves a click. On a phone or a tablet the same focus
 * raises the on-screen keyboard over half the page before anything on it has been read, so
 * there the field waits to be tapped.
 *
 * Where the browser cannot say, the answer is no: a field that waits costs one tap, and a
 * keyboard nobody asked for hides the page.
 */
export function keyboardToHand(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(hover: hover) and (pointer: fine)').matches
}
