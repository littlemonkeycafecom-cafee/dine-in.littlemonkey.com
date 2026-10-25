import json

with open('src/data/reconciled-menu.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

products = data['products']

updates_count = 0

for p in products:
    slug = p['slug']

    if slug == 'thin-crust-pizza-chicken-and-sweet-corn-pizza':
        p['variants'] = [{'name': 'Regular', 'price_paise': 44900}]
        p['is_price_unclear'] = False
        p['verification_flag'] = None
        p['description'] = 'CHICKEN, ONION, SWEET CORN, CHILLI FLAKES   11 inch, 8 slices'
        updates_count += 1

    elif slug == 'sandwiches-chicken-tikka':
        p['variants'] = [{'name': 'Regular', 'price_paise': 17900}]
        p['is_price_unclear'] = False
        p['verification_flag'] = None
        p['is_must_try'] = True
        p['description'] = 'Handcrafted chicken tikka sandwich'
        updates_count += 1

    elif slug == 'milkshakes-pina-colada':
        p['variants'] = [{'name': 'Regular', 'price_paise': 18900}]
        p['is_price_unclear'] = False
        p['verification_flag'] = None
        p['description'] = 'Refreshing pineapple and coconut blend'
        updates_count += 1

    elif slug == 'add-ons-cheese':
        p['variants'] = [{'name': 'Regular', 'price_paise': 7500}]
        p['verification_flag'] = None
        updates_count += 1

    elif slug == 'add-ons-sweet-corn':
        p['variants'] = [{'name': 'Regular', 'price_paise': 5000}]
        p['verification_flag'] = None
        updates_count += 1

    elif slug == 'add-ons-black-olive':
        p['variants'] = [{'name': 'Regular', 'price_paise': 5000}]
        p['verification_flag'] = None
        updates_count += 1

    elif slug == 'add-ons-irish':
        p['name'] = 'Irish'
        p['variants'] = [{'name': 'Regular', 'price_paise': 6000}]
        p['is_price_unclear'] = False
        p['verification_flag'] = None
        p['description'] = 'Irish cream syrup flavour add-on'
        updates_count += 1

    elif slug == 'extra-dips-extra-dip-sauces':
        p['name'] = 'Extra Dip (Sauces)'
        p['variants'] = [{'name': 'Regular', 'price_paise': 3000}]
        p['verification_flag'] = None
        p['description'] = 'Extra portion of dip / sauce'
        updates_count += 1

    elif slug == 'extra-dips-extra-olives':
        p['name'] = 'Extra Olives'
        p['variants'] = [{'name': 'Regular', 'price_paise': 3000}]
        p['verification_flag'] = None
        p['description'] = 'Extra portion of olives'
        updates_count += 1

    elif slug == 'fries-french-fries':
        p['variants'] = [
            {'name': 'Medium (M)', 'price_paise': 12900},
            {'name': 'Large (L)', 'price_paise': 16900}
        ]
        p['verification_flag'] = None
        updates_count += 1

    elif slug == 'fries-masala-french-fries':
        p['variants'] = [
            {'name': 'Medium (M)', 'price_paise': 14000},
            {'name': 'Large (L)', 'price_paise': 17900}
        ]
        p['verification_flag'] = None
        updates_count += 1

    elif slug == 'non-veg-starters-crumb-fried-prawns':
        p['name'] = 'Crumb Fried Prawns (4)'
        p['description'] = 'Golden crumb fried prawns, 4 pieces'
        p['verification_flag'] = None
        updates_count += 1

    elif slug == 'desserts-chocolaua':
        p['verification_flag'] = None
        updates_count += 1

    elif slug == 'healthy-bowls-veggie-and-paneer-rice-bowl':
        p['verification_flag'] = None
        updates_count += 1

    elif slug == 'mojito-hazelnut':
        p['verification_flag'] = None
        updates_count += 1

    elif slug == 'thin-crust-pizza-veggie-paradise-pizza':
        p['verification_flag'] = None
        updates_count += 1

    elif slug == 'thin-crust-pizza-peri-peri-italo-pizza':
        p['verification_flag'] = None
        updates_count += 1

# Check if packing charges exists as an item in add-ons-dips
has_packing = any(p['slug'] == 'add-ons-packing-charges' for p in products)
if not has_packing:
    products.append({
        "slug": "add-ons-packing-charges",
        "category": "add-ons-dips",
        "name": "Packing Charges",
        "description": "Takeaway packaging charge (charge item, optional)",
        "dietary_classification": "VEG",
        "is_must_try": False,
        "variants": [
            {
                "name": "Standard",
                "price_paise": 1500
            }
        ],
        "image_url": None,
        "is_available": True,
        "review": None
    })
    updates_count += 1

# Check if takeaway coffee cup exists as an item in add-ons-dips
has_cup = any(p['slug'] == 'add-ons-takeaway-coffee-cup' for p in products)
if not has_cup:
    products.append({
        "slug": "add-ons-takeaway-coffee-cup",
        "category": "add-ons-dips",
        "name": "Takeaway Coffee Cup with Lid",
        "description": "Takeaway coffee cup with lid (charge item, optional)",
        "dietary_classification": "VEG",
        "is_must_try": False,
        "variants": [
            {
                "name": "Standard",
                "price_paise": 1500
            }
        ],
        "image_url": None,
        "is_available": True,
        "review": None
    })
    updates_count += 1

with open('src/data/reconciled-menu.json', 'w', encoding='utf-8') as f:
    json.dump(data, f, indent=2, ensure_ascii=False)

print(f"Applied updates to {updates_count} items. Total products: {len(products)}")
