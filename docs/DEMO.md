# Demo Flow (15-minute talk)

## Users

| ID | Name | Persona |
|---|---|---|
| `user001` | Alice Chen | Intermediate hiker, Pacific Northwest, prefers Patagonia/Arc'teryx, budget up to $200 |
| `user002` | Bob Martinez | Beginner hiker, Colorado, budget-conscious (under $100), prefers Columbia/Merrell |
| `user003` | Carol Kim | Advanced mountaineer, Vermont, eco-focused, prefers Patagonia, budget up to $350 |

---

## Slide context (before opening the UI)

> "ADK and A2A give you the **control plane** — how agents are defined, discovered, and orchestrated. MongoDB gives you the **data and memory plane** — everything the agents know, remember, and decide persists here."

---

## Step 1 — Show the Agent Cards (A2A discovery)

Open `http://localhost:3000` and point to the three cards on the right side:

- **PlannerAgent** — interprets requests, delegates to sub-agents
- **ProductAgent** — semantic product search via Atlas Vector Search
- **ProfileAgent** — reads and updates long-term user memory

> "Each card is a real, spec-compliant A2A AgentCard — and each agent is an independent service. The Agents panel isn't showing hardcoded metadata; the orchestrator fetched these live from each agent's `/.well-known/agent-card.json`."

Optionally, prove it live from a terminal:

```bash
curl http://localhost:9092/.well-known/agent-card.json | jq
```

> "This is the ProductAgent's card, served from its own service on port 9092. The Planner discovers it exactly this way, then calls it over JSON-RPC. Any A2A-compatible orchestrator could do the same — including calling our Planner, which is itself an A2A service on 8081."

---

## Step 2 — Send a message as Alice

Select user **Alice Chen** (`user001`) from the dropdown.

Type:

> *"I need waterproof hiking boots under $150, size 9, from a sustainable brand"*

Wait for the response (~15–60 seconds). While it runs, narrate:

> "The PlannerAgent receives the request. It decides it needs both product data and Alice's profile before responding. It calls the ProfileAgent first — that reads Alice's preferences and any long-term memory we've stored about her. Then it calls the ProductAgent with the structured query — price cap $150, size 9, waterproof, eco-friendly. The ProductAgent runs an Atlas Vector Search with those filters, returns the top matches, and the Planner synthesizes a personalized recommendation."

---

## Step 3 — Show the Trace panel

After the response appears, expand the **Trace** panel on the right:

- `call_profile_agent` → `get_user_profile` + `get_user_memory`
- `call_product_agent` → `search_products` (with latency badge)

> "Every tool invocation — agent, tool name, exact input, output, and latency — is stored in MongoDB's `tool_invocations` collection. This is your audit log, your replay buffer, your fine-tuning dataset."

---

## Step 4 — Send a follow-up to trigger memory update

Type:

> *"Actually I only buy from Patagonia and Arc'teryx. Remember that."*

After the response:

> "The ProfileAgent's UpdateUserMemory tool just wrote a new fact to the `user_memory` collection. Next time Alice asks anything, that preference is already there — no re-prompting needed."

---

## Step 5 — Atlas Data Explorer (optional, high impact)

Open MongoDB Atlas → Data Explorer → your database:

| Collection | What to show |
|---|---|
| `tool_invocations` | 4–6 documents from this conversation; show `input`, `output`, `latency_ms` |
| `user_memory` | `user001` document with `facts` array updated |
| `sessions` | Full message history with timestamps |
| `agent_state` | `status: "completed"`, `steps_taken`, `agents_called` |

> "This is MongoDB as the agentic data plane. Not just a database — the substrate that makes the system observable, resumable, and improvable."
