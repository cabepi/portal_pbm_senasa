
import re
import json
import os

def parse_pharmacies():
    input_file = '/Users/cbetancur/Documents/Personal/AntigravityProjects/portal_pbm_senasa/raw_pharmacies.txt'
    output_dir = '/Users/cbetancur/Documents/Personal/AntigravityProjects/portal_pbm_senasa/src/data'
    output_file = os.path.join(output_dir, 'pharmacies.json')

    if not os.path.exists(output_dir):
        os.makedirs(output_dir)

    pharmacies = []
    
    with open(input_file, 'r', encoding='utf-8') as f:
        lines = f.readlines()

    # Skip header
    for line in lines[1:]:
        line = line.strip()
        if not line:
            continue
        
        # Match "Digits Spaces Rest"
        match = re.search(r'^(\d+)\s+(.+)$', line)
        if match:
            code = match.group(1)
            name = match.group(2)
            pharmacies.append({
                "code": code,
                "name": name
            })
        else:
            print(f"Skipping line: {line}")

    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(pharmacies, f, indent=4, ensure_ascii=False)
    
    print(f"Successfully processed {len(pharmacies)} pharmacies to {output_file}")

if __name__ == '__main__':
    parse_pharmacies()
