package com.mongodb.demo.retail.agents;

import com.anthropic.client.AnthropicClient;
import com.google.adk.agents.LlmAgent;
import com.google.adk.events.Event;
import com.google.adk.models.Claude;
import com.google.adk.runner.InMemoryRunner;
import com.google.adk.sessions.Session;
import com.google.adk.tools.AgentTool;
import com.google.genai.types.Content;
import com.google.genai.types.Part;
import com.mongodb.demo.retail.config.AgentContext;
import io.reactivex.rxjava3.core.Flowable;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;

@Component
public class PlannerAgent {

    private static final Logger log = LoggerFactory.getLogger(PlannerAgent.class);
    private static final String APP_NAME = "retail-advisor";

    private final LlmAgent llmAgent;
    private final InMemoryRunner runner;
    private final AgentCard agentCard;

    public PlannerAgent(ProductAgent productAgent,
                        ProfileAgent profileAgent,
                        AnthropicClient anthropicClient,
                        @Value("${anthropic.model}") String model) {
        this.llmAgent = LlmAgent.builder()
            .name("PlannerAgent")
            .description("Orchestrates the retail advisor workflow using specialist sub-agents")
            .instruction("""
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
                """)
            .model(new Claude(model, anthropicClient))
            .tools(
                AgentTool.create(profileAgent.getLlmAgent()),
                AgentTool.create(productAgent.getLlmAgent())
            )
            .build();

        this.runner = new InMemoryRunner(this.llmAgent, APP_NAME);

        this.agentCard = new AgentCard(
            "PlannerAgent",
            "Orchestrates the retail advisor workflow. Interprets user requests, delegates to specialist agents via A2A calls, and synthesizes final personalized recommendations.",
            "1.0",
            "local://planner-agent",
            List.of(
                new AgentCard.Skill(
                    "advise_on_products",
                    "Full end-to-end product advisory: reads user context, searches products, updates memory, returns personalized recommendations",
                    Map.of(
                        "user_id", "string",
                        "message", "string - the user's natural language request"
                    ),
                    "Personalized product recommendation with context from the user's profile and memory"
                )
            )
        );
    }

    public String run(String input, String userId, String mongoSessionId) {
        AgentContext.setSessionId(mongoSessionId);
        try {
            Session adkSession = runner.sessionService()
                .createSession(APP_NAME, userId)
                .blockingGet();

            Flowable<Event> events = runner.runAsync(
                userId,
                adkSession.id(),
                Content.fromParts(Part.fromText(input))
            );

            return extractFinalText(events);
        } finally {
            AgentContext.clear();
        }
    }

    public AgentCard getAgentCard() { return agentCard; }

    private String extractFinalText(Flowable<Event> events) {
        List<Event> eventList = events.toList().blockingGet();
        // Prefer the last turn-complete event with text content
        for (int i = eventList.size() - 1; i >= 0; i--) {
            Event event = eventList.get(i);
            if (event.turnComplete().orElse(false) && event.content().isPresent()) {
                String text = event.content().get().text();
                if (text != null && !text.isBlank()) return text.trim();
            }
        }
        // Fallback: any event with text content
        for (int i = eventList.size() - 1; i >= 0; i--) {
            Event event = eventList.get(i);
            if (event.content().isPresent()) {
                String text = event.content().get().text();
                if (text != null && !text.isBlank()) return text.trim();
            }
        }
        return "I was unable to generate a response.";
    }
}
