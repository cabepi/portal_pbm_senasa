import json
import re

def parse_medications(input_file, output_file):
    medications = []
    
    with open(input_file, 'r', encoding='utf-8') as f:
        lines = f.readlines()
        
    for line in lines:
        line = line.strip()
        if not line:
            continue
            
        # Match "Code   Description" (Code is digits, then whitespace, then diverse char description)
        # Using a simple split might work if tabs/spaces are consistent, but regex is safer
        # It seems the separator is multiple spaces or tabs.
        parts = re.split(r'\s{2,}|\t+', line, maxsplit=1)
        
        if len(parts) >= 2:
            code = parts[0].strip()
            name = parts[1].strip()
            medications.append({
                "code": code,
                "name": name
            })
        else:
            print(f"Skipping malformed line: {line}")

    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(medications, f, ensure_ascii=False, indent=2)
        
    print(f"Successfully processed {len(medications)} medications.")

if __name__ == "__main__":
    parse_medications(
        '/Users/cbetancur/Documents/Personal/AntigravityProjects/portal_pbm_senasa/raw_medications.txt',
        '/Users/cbetancur/Documents/Personal/AntigravityProjects/portal_pbm_senasa/src/data/medications.json'
    )
