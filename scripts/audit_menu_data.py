import json

with open('src/data/reconciled-menu.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

products = data['products']
print(f"Total products in reconciled-menu.json: {len(products)}")

targets = [
    "Chicken and Sweet Corn Pizza",
    "Pina Colada",
    "Cheese",
    "Sweet Corn",
    "Black Olive",
    "Mayo Dip",
    "Irish",
    "Extra Chicken (Pizza)",
    "Extra Chicken (Salads)",
    "Extra Dip (Sauces)",
    "Extra Olives",
    "Packing Charges",
    "Chicken Tikka",
    "Veggie Paradise Pizza",
    "Peri Peri Italo Pizza",
    "French Fries",
    "Masala French Fries",
    "Crumb Fried Prawns",
    "Chocolaua",
]

for p in products:
    name = p['name']
    cat = p['category']
    variants = p.get('variants', [])
    prices = [v['price_paise'] // 100 for v in variants] if variants else []
    for t in targets:
        if t.lower() in name.lower():
            print(f"{cat:20} | {name:38} | {str(prices):15} | unclear={p.get('is_price_unclear')} | flag={p.get('verification_flag')}")
            break
