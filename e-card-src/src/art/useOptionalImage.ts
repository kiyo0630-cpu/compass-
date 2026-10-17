/**
 * src/assets/ に画像（king.png など）が置かれていればその URL を返し、無ければ null を返す。
 * import.meta.glob によりビルド時に有無が確定するので、実行時に 404 を出して探しに行くことはない。
 * 対応拡張子: png / jpg / jpeg / webp
 */
const files = import.meta.glob('../assets/*.{png,jpg,jpeg,webp}', {
  eager: true,
  import: 'default',
}) as Record<string, string>

const byStem = new Map<string, string>()
for (const [path, url] of Object.entries(files)) {
  const stem = path.split('/').pop()!.replace(/\.(png|jpe?g|webp)$/i, '')
  if (!byStem.has(stem)) byStem.set(stem, url)
}

/** name は "king.png" のようなファイル名。拡張子は無視して同名の画像を探す */
export function useOptionalImage(name: string): string | null {
  const stem = name.replace(/\.(png|jpe?g|webp)$/i, '')
  return byStem.get(stem) ?? null
}
