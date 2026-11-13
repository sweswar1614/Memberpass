import json

path = "data/memberpass_qa.jsonl"

with open(path, encoding="utf-8-sig") as f:
    data = [json.loads(line) for line in f if line.strip()]

questions = [item["user"].strip().lower() for item in data]

print("Total examples:", len(data))
print("Unique questions:", len(set(questions)))
print("Duplicate questions:", len(questions) - len(set(questions)))
print("Empty answers:", sum(not item["assistant"].strip() for item in data))
