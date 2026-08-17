// Menswear (western) taxonomy that powers tagging and the outfit engine.

export type Category = 'top' | 'bottom' | 'shoes' | 'layer' | 'accessory'

export const CATEGORIES: { id: Category; label: string; emoji: string }[] = [
  { id: 'top', label: 'Top', emoji: '👕' },
  { id: 'bottom', label: 'Bottom', emoji: '👖' },
  { id: 'shoes', label: 'Shoes', emoji: '👟' },
  { id: 'layer', label: 'Layer', emoji: '🧥' },
  { id: 'accessory', label: 'Accessory', emoji: '⌚' },
]

export const SUBCATEGORIES: Record<Category, string[]> = {
  top: ['T-shirt', 'Polo', 'Casual shirt', 'Formal shirt', 'Henley', 'Sweatshirt', 'Sweater', 'Tank'],
  bottom: ['Jeans', 'Chinos', 'Formal trousers', 'Joggers', 'Shorts', 'Cargo pants'],
  shoes: ['Sneakers', 'Loafers', 'Formal shoes', 'Boots', 'Sandals', 'Running shoes'],
  layer: ['Denim jacket', 'Bomber', 'Blazer', 'Hoodie', 'Overshirt', 'Coat', 'Leather jacket', 'Cardigan'],
  accessory: ['Watch', 'Belt', 'Sunglasses', 'Cap', 'Beanie', 'Bracelet', 'Chain', 'Bag'],
}

export const SEASONS = ['Summer', 'Winter', 'Monsoon', 'All-season'] as const

export const DEFAULT_OCCASIONS = ['Casual', 'Office', 'Date', 'Party', 'Gym', 'Wedding/Event'] as const

export const FABRICS = [
  'Cotton', 'Linen', 'Denim', 'Wool', 'Polyester', 'Leather', 'Knit', 'Blend', 'Other',
] as const

export type LaundryStatus = 'clean' | 'dirty' | 'washing'

/** Surface pattern — two busy pieces together is a mistake colour alone can't catch. */
export const PATTERNS = ['Plain', 'Striped', 'Checked', 'Printed', 'Textured'] as const
export type Pattern = (typeof PATTERNS)[number]

export interface ItemColor {
  hex: string
  name: string
  ratio: number // 0..1 share of the garment
}

export interface Item {
  id: string
  user_id: string
  name: string
  category: Category
  subcategory: string
  colors: ItemColor[]
  primary_color: string
  seasons: string[]
  occasions: string[]
  fabric: string
  pattern: string
  laundry_status: LaundryStatus
  photo_path: string
  cutout_path: string | null
  notes: string
  times_worn: number
  last_worn: string | null
  created_at: string
  /** boxed away for the season — out of suggestions until brought back */
  archived: boolean
  needs_repair: boolean
  repair_note: string
  brand: string
  price: number | null
  purchased_on: string | null
  purchased_from: string
}
