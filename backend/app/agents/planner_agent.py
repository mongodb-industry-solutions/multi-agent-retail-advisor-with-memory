"""PlannerAgent — the orchestrator agent.

Unlike the specialists, the Planner is an A2A *client*: it discovers the Profile
and Product agents from their published ``/.well-known/agent-card.json`` and calls
them over the network via ADK's ``RemoteA2aAgent``. Each specialist is wrapped as
an ``AgentTool`` so the Planner calls it, gets the result back, and synthesizes the
final recommendation itself (mirroring the Java ``AgentTool`` orchestration).

Session correlation across the network: every outbound A2A HTTP request carries an
``X-Session-Id`` header, injected from a contextvar by the shared httpx client.
The specialist services read that header so their ``tool_invocations`` audit
records are stamped with the originating session (see ``services``).
"""
from __future__ import annotations

from google.adk.agents import LlmAgent
from google.adk.agents.remote_a2a_agent import AGENT_CARD_WELL_KNOWN_PATH, RemoteA2aAgent
from google.adk.tools.agent_tool import AgentTool

from ..common import config
from ..common.a2a import make_session_forwarding_client
from ..common.model import build_model

INSTRUCTION = """\
You are the Planner Agent — the orchestrator of a retail product advisor system.

You have access to two specialist agents via tools:
- ProfileAgent: reads and updates user preferences and long-term memory
- ProductAgent: searches the product catalog using semantic vector search + filters

WORKFLOW:
1. First, call ProfileAgent to get the user's context and preferences
2. Then, call ProductAgent to search for relevant products using the user's preferences as context
3. If you learn new facts about the user from their request, call ProfileAgent to update memory
4. Finally, synthesize everything into a warm, helpful product recommendation

Your final response should:
- Greet the user by referencing their context (if any)
- Recommend 2-3 specific products with name, brand, price, and why they match
- Note which products are eco-friendly / sustainable if the user cares
- Be conversational and genuinely helpful, not just a list dump

Always use the sub-agents — don't answer from your training data.
The products must come from the search results, not invented.
"""


# Client used for both A2A card resolution and message/send calls; it forwards
# the current session id (see common.a2a) so the specialists can correlate their
# tool_invocations back to the originating chat session.
_httpx_client = make_session_forwarding_client()


def _remote(name: str, description: str, base_url: str) -> RemoteA2aAgent:
    return RemoteA2aAgent(
        name=name,
        description=description,
        agent_card=f"{base_url}{AGENT_CARD_WELL_KNOWN_PATH}",
        httpx_client=_httpx_client,
        use_legacy=False,
    )


def build_planner_agent() -> LlmAgent:
    remote_profile = _remote(
        "ProfileAgent",
        "Reads and updates user preferences and long-term memory.",
        config.PROFILE_AGENT_URL,
    )
    remote_product = _remote(
        "ProductAgent",
        "Searches the product catalog using semantic vector search + filters.",
        config.PRODUCT_AGENT_URL,
    )
    return LlmAgent(
        name="PlannerAgent",
        description="Orchestrates the retail advisor workflow using specialist sub-agents over A2A",
        model=build_model(),
        instruction=INSTRUCTION,
        tools=[AgentTool(agent=remote_profile), AgentTool(agent=remote_product)],
    )


root_agent = build_planner_agent()
