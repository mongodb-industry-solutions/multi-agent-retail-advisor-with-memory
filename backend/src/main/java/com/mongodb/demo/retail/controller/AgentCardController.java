package com.mongodb.demo.retail.controller;

import com.mongodb.demo.retail.agents.AgentCard;
import com.mongodb.demo.retail.agents.AgentRegistry;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api")
public class AgentCardController {

    private final AgentRegistry agentRegistry;

    public AgentCardController(AgentRegistry agentRegistry) {
        this.agentRegistry = agentRegistry;
    }

    @GetMapping("/agents")
    public ResponseEntity<List<AgentCard>> listAgents() {
        return ResponseEntity.ok(agentRegistry.getAllCards());
    }
}
