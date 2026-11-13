import json

path = "data/memberpass_qa.jsonl"

with open(path, "r", encoding="utf-8-sig") as file:
    data = [json.loads(line) for line in file if line.strip()]

for i, item in enumerate(data, 1):
    assert "user" in item and "assistant" in item, f"Error at line {i}"

print("Dataset validation successful!")
print("Total training examples:", len(data))
print("First example:", data[0])
