import json
import re
import sys
from pathlib import Path

import torch
import torch.nn as nn

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from models.model import MemberPassGPT

DATA_PATH = ROOT / "data" / "memberpass_qa.jsonl"
MODEL_PATH = ROOT / "checkpoints" / "memberpass_model.pth"

EPOCHS = 100
LEARNING_RATE = 0.003
DEVICE = torch.device("cpu")

torch.manual_seed(42)


def tokenize(text):
    return re.findall(r"\w+|[^\w\s]", text.lower())


with open(DATA_PATH, encoding="utf-8-sig") as file:
    data = [json.loads(line) for line in file if line.strip()]

if not data:
    raise ValueError("Training dataset is empty.")

vocab = {"<PAD>": 0, "<UNK>": 1, "<BOS>": 2, "<EOS>": 3}

for item in data:
    for token in tokenize(item["user"] + " " + item["assistant"]):
        if token not in vocab:
            vocab[token] = len(vocab)

sequences = []

for item in data:
    tokens = (
        ["<BOS>"]
        + tokenize(item["user"])
        + ["<EOS>"]
        + tokenize(item["assistant"])
        + ["<EOS>"]
    )
    sequences.append([vocab[token] for token in tokens])

max_length = max(len(sequence) for sequence in sequences)

inputs = []
targets = []

for sequence in sequences:
    padded = sequence + [vocab["<PAD>"]] * (max_length - len(sequence))
    inputs.append(padded[:-1])
    targets.append(padded[1:])

x = torch.tensor(inputs, dtype=torch.long, device=DEVICE)
y = torch.tensor(targets, dtype=torch.long, device=DEVICE)

model = MemberPassGPT(len(vocab)).to(DEVICE)
optimizer = torch.optim.AdamW(model.parameters(), lr=LEARNING_RATE)
criterion = nn.CrossEntropyLoss(ignore_index=vocab["<PAD>"])

print("Training examples:", len(data))
print("Vocabulary size:", len(vocab))
print("Device:", DEVICE)

model.train()

for epoch in range(EPOCHS):
    optimizer.zero_grad()

    logits = model(x)

    loss = criterion(
        logits.reshape(-1, len(vocab)),
        y.reshape(-1)
    )

    loss.backward()
    optimizer.step()

    if (epoch + 1) % 10 == 0:
        print(f"Epoch {epoch + 1}/{EPOCHS} - Loss: {loss.item():.4f}")

torch.save(
    {
        "model_state_dict": model.state_dict(),
        "vocab": vocab,
        "max_length": max_length,
        "embedding_dim": 128,
        "hidden_dim": 256,
    },
    MODEL_PATH,
)

print("\nTraining completed!")
print("Model saved:", MODEL_PATH)
