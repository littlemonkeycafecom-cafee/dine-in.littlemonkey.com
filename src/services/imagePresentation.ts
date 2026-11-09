/**
 * Image Presentation & Art-Direction Service for Little Monkey Café
 *
 * Ensures all product photographs and drink renders fill their visual frames
 * naturally with zero awkward black bars, no distortion, no excessive empty bands,
 * and intelligent subject-focal centering across all aspect ratios.
 */

export interface ImagePresentationConfig {
  fit: 'cover' | 'contain';
  position: string;
  useBackdrop: boolean;
  padding?: string;
}

export function getImagePresentation(
  imageUrl: string | null | undefined,
  category?: string,
  slug?: string
): ImagePresentationConfig {
  if (!imageUrl) {
    return {
      fit: 'cover',
      position: 'center',
      useBackdrop: false,
    };
  }

  const cleanUrl = imageUrl.toLowerCase();
  const cleanCat = (category || '').toLowerCase();
  const cleanSlug = (slug || '').toLowerCase();

  // 1. Specialty cold brew bottles & drinks (fill frame cleanly with zero black bars or awkward letterboxing)
  if (
    cleanUrl.includes('/cold-brew/') ||
    cleanUrl.includes('cold-brew') ||
    cleanUrl.includes('tiger-bomb') ||
    cleanUrl.includes('espresso-orange') ||
    cleanUrl.includes('passion-fruit') ||
    cleanCat.includes('cold brew') ||
    cleanSlug.includes('cold-brew')
  ) {
    return {
      fit: 'cover',
      position: 'center 40%',
      useBackdrop: false,
    };
  }

  // 2. Pizzas in portrait photography (pizza is composed in upper half, center 22% ensures whole pizza is the hero)
  if (
    cleanUrl.includes('farmhouse') ||
    cleanUrl.includes('farm_house') ||
    cleanCat.includes('pizza') ||
    cleanSlug.includes('pizza')
  ) {
    return {
      fit: 'cover',
      position: 'center 22%',
      useBackdrop: true,
    };
  }

  // 3. Burgers (burger sits on wooden board/log in lower half, center 75% centers the burger)
  if (
    cleanUrl.includes('burger') ||
    cleanCat === 'burgers' ||
    cleanCat === 'burger-combos' ||
    cleanSlug.includes('burger')
  ) {
    return {
      fit: 'cover',
      position: 'center 75%',
      useBackdrop: true,
    };
  }

  // 4. Drinks, Boba & Coffees in glasses/mugs (center 40% frames the beverage and foam head)
  if (
    cleanUrl.includes('ice_coffee') ||
    cleanUrl.includes('ice_cofe') ||
    cleanUrl.includes('coco') ||
    cleanUrl.includes('tea') ||
    cleanUrl.includes('boba') ||
    cleanCat.includes('coffee') ||
    cleanCat.includes('shake') ||
    cleanCat.includes('tea') ||
    cleanCat === 'mojito'
  ) {
    return {
      fit: 'cover',
      position: 'center 40%',
      useBackdrop: true,
    };
  }

  // 5. Default for all other food dishes (pastas, sandwiches, shawarmas, fries, bowls, grills, desserts)
  return {
    fit: 'cover',
    position: 'center',
    useBackdrop: true,
  };
}
