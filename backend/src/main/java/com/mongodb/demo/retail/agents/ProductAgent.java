package com.mongodb.demo.retail.agents;

import com.anthropic.client.AnthropicClient;
import com.google.adk.agents.LlmAgent;
import com.google.adk.models.Claude;
import com.mongodb.demo.retail.tools.SearchProductsTool;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;

@Component
public class ProductAgent {

    private final LlmAgent llmAgent;
    private final AgentCard agentCard;

    public ProductAgent(SearchProductsTool searchProductsTool,
                        AnthropicClient anthropicClient,
                        @Value("${anthropic.model}") String model) {
        this.llmAgent = LlmAgent.builder()
            .name("ProductAgent")
            .description("Specializes in product discovery using MongoDB Atlas Vector Search")
            .instruction("""
                You are the Product Search Agent — a specialist in finding products from the catalog.

                Your ONLY job is to search for products that match what the user wants.
                Use the search_products tool with the appropriate query and filters.

                When you receive a search request:
                1. Extract the key search terms, price constraints, size requirements, and attribute preferences
                2. Call search_products with those parameters
                3. Return the search results in a structured format

                Always include: product name, brand, price, key attributes, and why each product matches.
                Be concise — just the product details, no fluff.
                """)
            .model(new Claude(model, anthropicClient))
            .tools(searchProductsTool)
            .build();

        this.agentCard = new AgentCard(
            "ProductAgent",
            "Specializes in product discovery using hybrid semantic vector search combined with structured attribute filters",
            "1.0",
            "local://product-agent",
            List.of(
                new AgentCard.Skill(
                    "search_products",
                    "Search the product catalog using semantic similarity and structured filters (price, size, waterproof, eco-friendly, category)",
                    Map.of(
                        "query", "string - natural language search query",
                        "max_price", "number - optional price ceiling in USD",
                        "size", "string - optional shoe or clothing size",
                        "waterproof", "boolean - optional waterproof filter",
                        "eco_friendly", "boolean - optional sustainability filter",
                        "category", "string - optional product category"
                    ),
                    "Array of matching products with name, brand, price, attributes, and relevance score"
                )
            )
        );
    }

    public LlmAgent getLlmAgent() { return llmAgent; }
    public AgentCard getAgentCard() { return agentCard; }
}
