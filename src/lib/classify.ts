// Work out what a garment *is* from its photo, so adding clothes needs no
// tagging. Uses CLIP zero-shot classification in the browser: the image is
// scored against a written description of every garment type in the taxonomy,
// and the best match gives both the category and the specific type.

import { getPipeline, type Progress } from './hf'
import { SUBCATEGORIES, type Category } from './taxonomy'

const MODEL = 'Xenova/clip-vit-base-patch32'

/**
 * Descriptions matter more than labels here — CLIP responds to natural phrasing,
 * and "trousers" beats "bottom". Each maps back to a taxonomy subcategory.
 */
const PROMPTS: { text: string; category: Category; subcategory: string }[] = [
  // tops
  { text: 'a plain t-shirt', category: 'top', subcategory: 'T-shirt' },
  { text: 'a polo shirt with a collar and buttons', category: 'top', subcategory: 'Polo' },
  { text: 'a casual button-up shirt', category: 'top', subcategory: 'Casual shirt' },
  { text: 'a formal dress shirt', category: 'top', subcategory: 'Formal shirt' },
  { text: 'a henley shirt', category: 'top', subcategory: 'Henley' },
  { text: 'a sweatshirt', category: 'top', subcategory: 'Sweatshirt' },
  { text: 'a knitted sweater or jumper', category: 'top', subcategory: 'Sweater' },
  { text: 'a sleeveless tank top or vest', category: 'top', subcategory: 'Tank' },
  // bottoms
  { text: 'a pair of blue denim jeans', category: 'bottom', subcategory: 'Jeans' },
  { text: 'a pair of chino trousers', category: 'bottom', subcategory: 'Chinos' },
  { text: 'a pair of formal suit trousers', category: 'bottom', subcategory: 'Formal trousers' },
  { text: 'a pair of jogger sweatpants', category: 'bottom', subcategory: 'Joggers' },
  { text: 'a pair of short trousers, shorts', category: 'bottom', subcategory: 'Shorts' },
  { text: 'a pair of cargo pants with side pockets', category: 'bottom', subcategory: 'Cargo pants' },
  // shoes
  { text: 'a pair of casual sneakers or trainers', category: 'shoes', subcategory: 'Sneakers' },
  { text: 'a pair of leather loafers', category: 'shoes', subcategory: 'Loafers' },
  { text: 'a pair of formal leather dress shoes', category: 'shoes', subcategory: 'Formal shoes' },
  { text: 'a pair of boots', category: 'shoes', subcategory: 'Boots' },
  { text: 'a pair of sandals or flip flops', category: 'shoes', subcategory: 'Sandals' },
  { text: 'a pair of athletic running shoes', category: 'shoes', subcategory: 'Running shoes' },
  // layers
  { text: 'a denim jacket', category: 'layer', subcategory: 'Denim jacket' },
  { text: 'a bomber jacket', category: 'layer', subcategory: 'Bomber' },
  { text: 'a tailored suit blazer', category: 'layer', subcategory: 'Blazer' },
  { text: 'a hooded sweatshirt, a hoodie', category: 'layer', subcategory: 'Hoodie' },
  { text: 'a heavy overshirt or shacket', category: 'layer', subcategory: 'Overshirt' },
  { text: 'a long winter coat', category: 'layer', subcategory: 'Coat' },
  { text: 'a leather jacket', category: 'layer', subcategory: 'Leather jacket' },
  { text: 'a knitted cardigan', category: 'layer', subcategory: 'Cardigan' },
  // accessories
  { text: 'a wristwatch', category: 'accessory', subcategory: 'Watch' },
  { text: 'a leather belt', category: 'accessory', subcategory: 'Belt' },
  { text: 'a pair of sunglasses', category: 'accessory', subcategory: 'Sunglasses' },
  { text: 'a baseball cap', category: 'accessory', subcategory: 'Cap' },
  { text: 'a knitted beanie hat', category: 'accessory', subcategory: 'Beanie' },
  { text: 'a bracelet', category: 'accessory', subcategory: 'Bracelet' },
  { text: 'a neck chain or necklace', category: 'accessory', subcategory: 'Chain' },
  { text: 'a bag or backpack', category: 'accessory', subcategory: 'Bag' },
]

export interface Classification {
  category: Category
  subcategory: string
  /** 0..1 — below ~0.25 the guess is weak and worth showing as uncertain */
  confidence: number
}

type ZeroShot = (
  image: string,
  labels: string[],
) => Promise<{ label: string; score: number }[]>

/**
 * Identify a garment from its image. Falls back to a plain top rather than
 * throwing: a wrong guess the user can correct beats a failed upload.
 */
export async function classifyGarment(
  image: Blob,
  onProgress?: Progress,
): Promise<Classification> {
  const url = URL.createObjectURL(image)
  try {
    onProgress?.('Identifying the garment…')
    const classifier = (await getPipeline(
      'zero-shot-image-classification',
      MODEL,
      onProgress,
      'recogniser',
    )) as ZeroShot

    const results = await classifier(
      url,
      PROMPTS.map((p) => p.text),
    )
    if (!results?.length) return fallback()

    const scoreOf = new Map(results.map((r) => [r.label, r.score ?? 0]))

    // Decide the category from all of its prompts combined, not from whichever
    // single phrase happened to win. Getting "shoes" right decides which slot
    // an item fills in an outfit; T-shirt versus polo barely matters. One odd
    // prompt should not be able to drag a shoe into accessories.
    const byCategory = new Map<Category, number>()
    for (const p of PROMPTS) {
      byCategory.set(p.category, (byCategory.get(p.category) ?? 0) + (scoreOf.get(p.text) ?? 0))
    }
    const ranked = [...byCategory.entries()].sort((a, b) => b[1] - a[1])
    const [category, categoryScore] = ranked[0]
    const runnerUp = ranked[1]?.[1] ?? 0

    // Best phrasing within the chosen category.
    const best = PROMPTS.filter((p) => p.category === category).sort(
      (a, b) => (scoreOf.get(b.text) ?? 0) - (scoreOf.get(a.text) ?? 0),
    )[0]

    // Confidence is how far ahead the winning category is, not its raw score —
    // with three dozen competing phrases every absolute score looks low.
    const margin = categoryScore > 0 ? (categoryScore - runnerUp) / categoryScore : 0

    return {
      category,
      subcategory: best?.subcategory ?? SUBCATEGORIES[category][0],
      confidence: Math.max(0, Math.min(1, margin)),
    }
  } catch {
    return fallback()
  } finally {
    URL.revokeObjectURL(url)
  }
}

function fallback(): Classification {
  return { category: 'top', subcategory: SUBCATEGORIES.top[0], confidence: 0 }
}

/**
 * Sensible default occasions for a garment type, so a drop-and-go upload still
 * produces items the outfit engine can reason about without being asked.
 */
export function defaultOccasions(subcategory: string): string[] {
  const formal = ['Formal shirt', 'Formal trousers', 'Formal shoes', 'Blazer']
  const gym = ['Joggers', 'Running shoes', 'Tank']
  const smart = ['Polo', 'Chinos', 'Loafers', 'Casual shirt', 'Sweater', 'Cardigan', 'Overshirt']

  if (formal.includes(subcategory)) return ['Office', 'Wedding/Event']
  if (gym.includes(subcategory)) return ['Gym']
  if (smart.includes(subcategory)) return ['Casual', 'Office', 'Date']
  return ['Casual']
}

/** Warm-weather and cold-weather pieces shouldn't be tagged all-season. */
export function defaultSeasons(subcategory: string): string[] {
  const winter = ['Coat', 'Sweater', 'Cardigan', 'Beanie', 'Leather jacket', 'Sweatshirt']
  const summer = ['Shorts', 'Tank', 'Sandals']
  if (winter.includes(subcategory)) return ['Winter']
  if (summer.includes(subcategory)) return ['Summer']
  return ['All-season']
}
