package com.mongodb.demo.retail.agents;

import com.anthropic.client.AnthropicClient;
import com.google.adk.agents.LlmAgent;
import com.google.adk.models.Claude;
import com.mongodb.demo.retail.tools.GetUserMemoryTool;
import com.mongodb.demo.retail.tools.GetUserProfileTool;
import com.mongodb.demo.retail.tools.UpdateUserMemoryTool;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;

@Component
public class ProfileAgent {

    private final LlmAgent llmAgent;
    private final AgentCard agentCard;

    public ProfileAgent(GetUserProfileTool getUserProfileTool,
                        GetUserMemoryTool getUserMemoryTool,
                        UpdateUserMemoryTool updateUserMemoryTool,
                        AnthropicClient anthropicClient,
                        @Value("${anthropic.model}") String model) {
        this.llmAgent = LlmAgent.builder()
            .name("ProfileAgent")
            .description("Manages user profiles and long-term memory in MongoDB")
            .instruction("""
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
                """)
            .model(new Claude(model, anthropicClient))
            .tools(getUserProfileTool, getUserMemoryTool, updateUserMemoryTool)
            .build();

        this.agentCard = new AgentCard(
            "ProfileAgent",
            "Manages user profiles and long-term memory. Reads preferences, past interactions, and facts. Writes new learned facts to persistent storage.",
            "1.0",
            "local://profile-agent",
            List.of(
                new AgentCard.Skill(
                    "get_user_context",
                    "Retrieve full user context: profile preferences, stored memory facts, size info, and brand preferences",
                    Map.of("user_id", "string - the user's unique identifier"),
                    "Combined user profile and memory facts as a structured summary"
                ),
                new AgentCard.Skill(
                    "update_user_memory",
                    "Persist new facts learned about the user into long-term memory storage in MongoDB",
                    Map.of(
                        "user_id", "string - the user's unique identifier",
                        "new_facts", "string[] - list of concise fact strings to memorize"
                    ),
                    "Confirmation of facts saved"
                )
            )
        );
    }

    public LlmAgent getLlmAgent() { return llmAgent; }
    public AgentCard getAgentCard() { return agentCard; }
}
