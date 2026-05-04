package com.mongodb.demo.retail.agents;

import org.springframework.stereotype.Component;

import java.util.List;

@Component
public class AgentRegistry {

    private final List<AgentCard> agentCards;

    public AgentRegistry(PlannerAgent plannerAgent,
                         ProductAgent productAgent,
                         ProfileAgent profileAgent) {
        this.agentCards = List.of(
                plannerAgent.getAgentCard(),
                productAgent.getAgentCard(),
                profileAgent.getAgentCard()
        );
    }

    public List<AgentCard> getAllCards() {
        return agentCards;
    }
}
