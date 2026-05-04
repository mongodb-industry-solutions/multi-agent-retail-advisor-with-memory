package com.mongodb.demo.retail.agents;

import java.util.List;

public record AgentCard(
        String name,
        String description,
        String version,
        String endpoint,
        List<Skill> skills
) {
    public record Skill(
            String name,
            String description,
            Object inputSchema,
            String outputDescription
    ) {}
}
