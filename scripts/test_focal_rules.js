import fs from 'node:fs';

const menu = JSON.parse(fs.readFileSync('./src/data/reconciled-menu.json', 'utf8'));
const mapStr = fs.readFileSync('src/services/productImageMap.ts', 'utf8');

function resolveImg(slug) {
  const match = mapStr.match(new RegExp("'" + slug + "':\\s*'([^']+)'"));
  return match ? match[1] : null;
}

export function getImagePresentation(imageUrl, category, slug) {
  if (!imageUrl) {
    return { fit: 'cover', position: 'center', useBackdrop: false };
  }

  // 1. Cutout PNG drinks and specialty cold brew transparent assets
  if (imageUrl.includes('/cold-brew/') && imageUrl.endsWith('.png')) {
    return {
      fit: 'contain',
      position: 'center',
      useBackdrop: true,
      scale: 1,
    };
  }

  // 2. Pizzas with portrait orientation (pizza is composed in upper half)
  if (
    imageUrl.includes('farmhouse') ||
    imageUrl.includes('farm_house') ||
    (category && (category.includes('pizza') || category === 'thin-crust-pizza'))
  ) {
    return {
      fit: 'cover',
      position: 'center 22%',
      useBackdrop: true,
    };
  }

  // 3. Burgers (burger sits on wooden board/log in lower half)
  if (
    imageUrl.includes('burger') ||
    (category && (category === 'burgers' || category === 'burger-combos'))
  ) {
    return {
      fit: 'cover',
      position: 'center 75%',
      useBackdrop: true,
    };
  }

  // 4. Drinks & Coffees in glasses/mugs
  if (
    imageUrl.includes('coffee') ||
    imageUrl.includes('coco') ||
    imageUrl.includes('tea') ||
    imageUrl.includes('boba') ||
    (category && (
      category.includes('coffee') ||
      category.includes('shake') ||
      category.includes('tea') ||
      category === 'mojito'
    ))
  ) {
    return {
      fit: 'cover',
      position: 'center 38%',
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

const sampleSlugs = [
  'thin-crust-pizza-spicy-mexican-pizza',
  'thin-crust-pizza-margherita',
  'burgers-crispy-chicken-burger',
  'pasta-pasta-veg',
  'cold-brew-tiger-bomb',
  'cold-brew-mont-blanc',
  'fries-peri-peri-french-fries',
  'sandwiches-veg-sandwich',
  'garlic-bread-cheese-garlic-bread'
];

sampleSlugs.forEach(slug => {
  const p = menu.products.find(x => x.slug === slug);
  const img = resolveImg(slug) || (p ? p.image_url : null) || (slug.includes('tiger-bomb') ? '/images/cold-brew/tiger-bomb.png' : '/images/products/ice_coffee_1.jpg');
  const cat = p ? p.category : (slug.includes('cold-brew') ? 'cold-brew' : '');
  const cfg = getImagePresentation(img, cat, slug);
  console.log(slug + ' (' + img + ') -> fit: ' + cfg.fit + ', pos: ' + cfg.position + ', backdrop: ' + cfg.useBackdrop);
});
