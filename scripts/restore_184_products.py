import json

with open('src/data/reconciled-menu.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

# Keep only the original 184 items (filter out any accidentally added test slugs)
valid_products = []
for p in data['products']:
    if p['slug'] in ['add-ons-packing-charges', 'add-ons-takeaway-coffee-cup']:
        continue
    valid_products.append(p)

assert len(valid_products) == 184, f"Expected 184 products, got {len(valid_products)}"

data['products'] = valid_products

with open('src/data/reconciled-menu.json', 'w', encoding='utf-8') as f:
    json.dump(data, f, indent=2, ensure_ascii=False)

print(f"Catalog successfully set to exactly 184 products.")
