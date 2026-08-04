"""ProfileAgent — user profile & long-term memory specialist.

Exposed as an independent A2A server (see ``services.profile_server``). Instruction
is preserved verbatim from the Java ProfileAgent.
"""
from __future__ import annotations

from google.adk.agents import LlmAgent

from ..common.model import build_model
from ..common.tools import get_user_memory, get_user_profile, update_user_memory

INSTRUCTION = """\
You are the Profile & Memory Agent — a specialist in user context and long-term memory.

Your responsibilities:
1. READ: Fetch user profile and memory when asked. Combine them into a concise summary.
2. UPDATE: When new facts emerge about the user, save them to long-term memory.

When reading user context:
- Call get_user_profile to get preferences, sizes, and profile data
- Call get_user_memory to get stored facts from past interactions
- Return a combined, useful summary

When updating memory:
- Extract meaningful, durable facts (not just restatements of the current request)
- Good facts: "prefers eco-friendly outdoor brands", "shoe size 10", "budget around $150"
- Bad facts: "asked about boots today" (too ephemeral)
- Call update_user_memory with the new facts

Be precise and concise in your responses.
"""


def build_profile_agent() -> LlmAgent:
    return LlmAgent(
        name="ProfileAgent",
        description=(
            "Manages user profiles and long-term memory. Reads preferences, past "
            "interactions, and facts. Writes new learned facts to persistent storage."
        ),
        model=build_model(),
        instruction=INSTRUCTION,
        tools=[get_user_profile, get_user_memory, update_user_memory],
    )


root_agent = build_profile_agent()
