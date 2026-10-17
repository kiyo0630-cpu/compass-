import { useEffect, useState } from 'react'

const cache = new Map<string, boolean>()

/**
 * public/ 配下に画像が存在すればそれを使い、無ければ SVG フォールバックに切り替えるためのフック。
 * 返り値が true のときだけ <img> を描画する。
 */
export function useOptionalImage(name: string): string | null {
  const src = `${import.meta.env.BASE_URL}${name}`
  const [ok, setOk] = useState<boolean>(cache.get(src) ?? false)

  useEffect(() => {
    if (cache.has(src)) {
      setOk(cache.get(src)!)
      return
    }
    let alive = true
    const img = new Image()
    img.onload = () => {
      cache.set(src, true)
      if (alive) setOk(true)
    }
    img.onerror = () => {
      cache.set(src, false)
      if (alive) setOk(false)
    }
    img.src = src
    return () => {
      alive = false
    }
  }, [src])

  return ok ? src : null
}
