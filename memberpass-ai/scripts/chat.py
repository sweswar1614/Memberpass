import re
import sys
from pathlib import Path

import torch

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from models.model import MemberPassGPT

CHECKPOINT = ROOT / "checkpoints" / "memberpass_model.pth"
DEVICE = "cpu"


def tokenize(text):
    return re.findall(r"\w+|[^\w\s]", text.lower())


checkpoint = torch.load(CHECKPOINT, map_location=DEVICE, weights_only=True)

vocab = checkpoint["vocab"]
reverse_vocab = {value: key for key, value in vocab.items()}

model = MemberPassGPT(
    len(vocab),
    checkpoint["embedding_dim"],
    checkpoint["hidden_dim"]
).to(DEVICE)

model.load_state_dict(checkpoint["model_state_dict"])
model.eval()


def generate_answer(question, max_new_tokens=100):
    tokens = ["<BOS>"] + tokenize(question) + ["<EOS>"]
    ids = [vocab.get(token, vocab["<UNK>"]) for token in tokens]
    generated = []

    with torch.no_grad():
        for _ in range(max_new_tokens):
            x = torch.tensor([ids], dtype=torch.long, device=DEVICE)
            logits = model(x)
            next_id = int(torch.argmax(logits[0, -1]).item())

            if next_id == vocab["<EOS>"]:
                break

            if next_id in (vocab["<PAD>"], vocab["<BOS>"]):
                break

            generated.append(reverse_vocab[next_id])
            ids.append(next_id)

    answer = " ".join(generated)
    answer = re.sub(r"\s+([?.!,])", r"\1", answer)
    return answer


print("MemberPass AI Assistant")
print("Type 'exit' to stop.\n")

while True:
    question = input("You: ").strip()

    if question.lower() in ("exit", "quit"):
        print("Assistant: Goodbye!")
        break

    if question:
        print("Assistant:", generate_answer(question), "\n")
