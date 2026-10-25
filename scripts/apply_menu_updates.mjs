import fs from 'fs';

const rawData = JSON.parse(fs.readFileSync('src/data/reconciled-menu.json', 'utf8'));

// Update products based on authoritative Section 3 extraction
const products = rawData.products.map(p => {
  const item = { ...p };

  // Category unification for Add-ons & Dips
  if (item.category === 'add-ons' || item.category === 'extra-dips') {
    item.category = 'add-ons-dips';
  }
  // Category unification for Starters & Sides
  if (item.category === 'garlic-bread' || item.category === 'sides-quick-bites') {
    item.category = 'starters-sides';
  }
  // Category unification for Non-Veg Starters
  if (item.category === 'crispy-chicken' || item.category === 'crispy-fish') {
    item.category = 'non-veg-starters';
  }
  if (item.category === 'special-green-tea-pot') {
    item.category = 'special-green-tea';
  }

  // A. PIZZA
  if (item.slug === 'thin-crust-pizza-margherita-pizza') {
    item.name = 'Margherita Pizza';
    item.variants = [{ name: 'Regular', price_paise: 27900 }];
    item.description = 'Cheese and tomato topping • 11 inch, 8 slices';
  }
  if (item.slug === 'thin-crust-pizza-farmhouse') {
    item.name = 'Farmhouse Pizza';
    item.description = 'Onion, capsicum, sweet corn, tomatoes, olives • 11 inch, 8 slices';
    item.variants = [{ name: 'Regular', price_paise: 39900 }];
  }
  if (item.slug === 'thin-crust-pizza-veggie-paradise-pizza') {
    item.name = 'Veggie Paradise Pizza';
    item.description = 'Onion, capsicum, jalapeños, olives • 11 inch, 8 slices';
    item.verification_flag = 'Source-extracted: DEGGIE PARADISE PIZZA. Verify exact spelling.';
    item.variants = [{ name: 'Regular', price_paise: 41000 }];
  }
  if (item.slug === 'thin-crust-pizza-peri-peri-italio-pizza') {
    item.name = 'Peri Peri Italo Pizza';
    item.description = 'Onion, capsicum, jalapeño, baby corn, mushroom, black olives, spicy peri-peri sauce • 11 inch, 8 slices';
    item.verification_flag = 'Source-extracted: PERI PERI ITALIO PIZZA. Verify exact spelling.';
    item.variants = [{ name: 'Regular', price_paise: 44900 }];
  }
  if (item.slug === 'thin-crust-pizza-chicken-and-sweet-corn-pizza') {
    item.name = 'Chicken and Sweet Corn Pizza';
    item.description = 'Chicken, onion, sweet corn, chilli flakes • 11 inch, 8 slices';
    item.is_price_unclear = true;
    item.verification_flag = 'PRICE NOT CLEAR in source extraction — verify against menu PDF';
    item.variants = [{ name: 'Price to be verified', price_paise: 0 }];
  }
  if (item.slug === 'thin-crust-pizza-chicken-pepperoni') {
    item.name = 'Chicken Pepperoni Pizza';
    item.description = 'Pepperoni chicken, cheese, herbs • 11 inch, 8 slices';
    item.variants = [{ name: 'Regular', price_paise: 49900 }];
  }

  // D. SANDWICHES
  if (item.slug === 'sandwiches-chicken-tikka') {
    item.name = 'Chicken Tikka';
    item.is_price_unclear = true;
    item.verification_flag = 'PRICE NOT CLEAR in source extraction — verify against menu PDF';
    item.variants = [{ name: 'Price to be verified', price_paise: 0 }];
  }

  // F. FRENCH FRIES
  if (item.slug === 'fries-french-fries') {
    item.name = 'French Fries';
    item.description = 'Mixed with salt • Note: Two sizes listed in menu (Verify size labels)';
    item.verification_flag = 'Two prices listed in source; size labels unconfirmed (Do not assign size labels without checking original menu)';
    item.variants = [
      { name: 'Portion 1', price_paise: 12900 },
      { name: 'Portion 2', price_paise: 16900 }
    ];
  }
  if (item.slug === 'fries-masala-french-fries') {
    item.name = 'Masala French Fries';
    item.description = 'Peri-peri mix, as extracted; verify description • Note: Two sizes listed in menu (Verify size labels)';
    item.verification_flag = 'Two prices listed in source; size labels unconfirmed (Do not assign size labels without checking original menu)';
    item.variants = [
      { name: 'Portion 1', price_paise: 14000 },
      { name: 'Portion 2', price_paise: 17900 }
    ];
  }

  // K. DESSERTS
  if (item.slug === 'desserts-chocolava') {
    item.name = 'Chocolaua';
    item.verification_flag = 'Verify spelling of Chocolaua against original menu';
    item.variants = [{ name: 'Regular', price_paise: 12000 }];
  }
  if (item.slug === 'desserts-chocolava-with-ice-cream') {
    item.name = 'Chocolaua with Ice Cream';
    item.variants = [{ name: 'Regular', price_paise: 15900 }];
  }

  // L. NON-VEG STARTERS
  if (item.slug === 'crispy-fish-crispy-fish-fingers-5') {
    item.name = 'Crispy Fish Fingers (5 pieces)';
    item.variants = [{ name: 'Regular', price_paise: 19900 }];
  }
  if (item.slug === 'crispy-fish-crumb-fried-prawns-4') {
    item.name = 'Crumb Fried Prawns';
    item.verification_flag = 'Quantity is unclear in the extracted source';
    item.variants = [{ name: 'Regular', price_paise: 19900 }];
  }
  if (item.slug === 'crispy-fish-fish-chips') {
    item.name = 'Fish and Chips';
    item.variants = [{ name: 'Regular', price_paise: 43900 }];
  }

  // N. HEALTHY BOWLS
  if (item.slug === 'healthy-bowls-veggi-paneer-rice-bowl') {
    item.name = 'Veggie and Paneer Rice Bowl';
    item.verification_flag = 'Source-extracted name: DEGGI & PANEER RICE BOWL. Verify exact spelling.';
    item.variants = [{ name: 'Regular', price_paise: 19900 }];
  }

  // Q. ADD-ONS & DIPS
  if (item.slug === 'add-ons-cheese') {
    item.name = 'Cheese';
    item.variants = [{ name: 'Regular', price_paise: 7300 }];
  }
  if (item.slug === 'add-ons-sweet-corn') {
    item.name = 'Sweet Corn';
    item.variants = [{ name: 'Regular', price_paise: 3000 }];
  }
  if (item.slug === 'add-ons-black-olive') {
    item.name = 'Black Olive';
    item.variants = [{ name: 'Regular', price_paise: 5300 }];
  }
  if (item.slug === 'add-ons-irish') {
    item.name = 'Unclear Add-on (Verify Menu)';
    item.is_price_unclear = true;
    item.verification_flag = 'Unclear item between Vanilla and Caramel in source extraction — verify against menu PDF';
    item.variants = [{ name: 'Price to be verified', price_paise: 0 }];
  }
  if (item.slug === 'extra-dips-extra-dip-sauces') {
    item.name = 'Packing Charges';
    item.description = 'Takeaway packaging charge';
    item.variants = [{ name: 'Standard', price_paise: 1500 }];
  }
  if (item.slug === 'extra-dips-extra-olives') {
    item.name = 'Takeaway Coffee Cup with Lid';
    item.description = 'Takeaway coffee cup with lid extra charge';
    item.variants = [{ name: 'Standard', price_paise: 1500 }];
  }

  // R. MILKSHAKES
  if (item.slug === 'milkshakes-pinacolada') {
    item.name = 'Pina Colada';
    item.is_price_unclear = true;
    item.verification_flag = 'PRICE NOT CLEAR in source extraction — verify against menu PDF';
    item.variants = [{ name: 'Price to be verified', price_paise: 0 }];
  }

  // T. MOJITOS
  if (item.slug === 'mojito-water-melon') {
    item.name = 'Watermelon Mojito';
    item.variants = [{ name: 'Regular', price_paise: 16900 }];
  }
  if (item.slug === 'mojito-hazelnut') {
    item.name = 'Hazelnut';
    item.verification_flag = 'Verify whether Hazelnut is a mojito variant or belongs to another section';
    item.variants = [{ name: 'Regular', price_paise: 16900 }];
  }

  // AD. SPECIAL GREEN TEA
  if (item.category === 'special-green-tea') {
    if (item.slug === 'special-green-tea-pot-chamomile-detox-stress-relief') {
      item.name = 'Chamomile';
      item.description = 'Herbal infusion • Source note: Traditional relaxation tea';
    }
    if (item.slug === 'special-green-tea-pot-turmeric-immunity-booster') {
      item.name = 'Turmeric';
      item.description = 'Herbal infusion • Source note: Traditional golden spice blend';
    }
    if (item.slug === 'special-green-tea-pot-slimming-weight-loss') {
      item.name = 'Slimming';
      item.description = 'Herbal green tea blend';
    }
    if (item.slug === 'special-green-tea-pot-hibiscus-liver-booster') {
      item.name = 'Hibiscus';
      item.description = 'Herbal floral infusion';
    }
    if (item.slug === 'special-green-tea-pot-blue-tea-hair-skin-booster') {
      item.name = 'Blue Tea';
      item.description = 'Butterfly pea flower herbal tea';
    }
  }

  return item;
});

rawData.products = products;
fs.writeFileSync('src/data/reconciled-menu.json', JSON.stringify(rawData, null, 2));
console.log('Successfully updated src/data/reconciled-menu.json with authoritative Section 3 menu content!');
