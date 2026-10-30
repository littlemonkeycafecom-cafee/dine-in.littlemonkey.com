import os, glob, json

search_terms = ['marquee', 'unexpected width', 'expanding to 100%', 'click/tap']
dirs = [
    r'C:\Users\chava\.gemini\antigravity\brain',
    r'C:\Users\chava\.gemini\antigravity-ide\brain'
]

for d in dirs:
    for fpath in glob.glob(os.path.join(d, '**', 'transcript*.jsonl'), recursive=True):
        if 'full' not in fpath:
            continue
        try:
            with open(fpath, 'r', encoding='utf-8') as f:
                for line in f:
                    for t in search_terms:
                        if t.lower() in line.lower() and '"USER_INPUT"' in line:
                            data = json.loads(line)
                            c = data.get('content', '')
                            if any(k in c.lower() for k in search_terms):
                                print(f'FOUND in {fpath}:')
                                print(c[:300].strip())
                                print('-'*40)
                                break
        except Exception:
            pass
