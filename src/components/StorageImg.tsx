import { useEffect, useState } from 'react'
import { imageUrl } from '../lib/db'

/** Renders an image stored in the private Supabase bucket via signed URL. */
export default function StorageImg({
  path,
  alt,
  className,
}: {
  path: string | null
  alt: string
  className?: string
}) {
  const [src, setSrc] = useState<string | null>(null)
  useEffect(() => {
    let live = true
    imageUrl(path).then((u) => { if (live) setSrc(u) })
    return () => { live = false }
  }, [path])

  if (!src) return <div className={`animate-pulse bg-paper ${className ?? ''}`} />
  return <img src={src} alt={alt} loading="lazy" className={className} />
}
