import re
import sys
from pathlib import Path

import torch
from fastapi import FastAPI
from pydantic import BaseModel, Field

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT))

from models.model import MemberPassGPT

CHECKPOINT = ROOT / "checkpoints" / "memberpass_model.pth"
DEVICE = "cpu"

checkpoint = torch.load(
    CHECKPOINT,
    map_location=DEVICE,
    weights_only=True
)

vocab = checkpoint["vocab"]
reverse_vocab = {value: key for key, value in vocab.items()}

model = MemberPassGPT(
    len(vocab),
    checkpoint["embedding_dim"],
    checkpoint["hidden_dim"]
).to(DEVICE)

model.load_state_dict(checkpoint["model_state_dict"])
model.eval()

app = FastAPI(title="MemberPass AI API", version="1.0.0")


class ChatRequest(BaseModel):
    question: str = Field(min_length=1, max_length=500)


def tokenize(text):
    return re.findall(r"\w+|[^\w\s]", text.lower())


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
    return re.sub(r"\s+([?.!,])", r"\1", answer)


@app.get("/")
def home():
    return {
        "success": True,
        "message": "MemberPass AI API is running"
    }


@app.get("/health")
def health():
    return {
        "success": True,
        "model_loaded": True,
        "device": DEVICE
    }


@app.post("/chat")
def chat(request: ChatRequest):
    answer = generate_answer(request.question)

    return {
        "success": True,
        "question": request.question,
        "answer": answer
    }
