package com.mongodb.demo.retail.controller;

import com.mongodb.demo.retail.model.ChatRequest;
import com.mongodb.demo.retail.model.ChatResponse;
import com.mongodb.demo.retail.orchestration.WorkflowOrchestrator;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api")
public class ChatController {

    private final WorkflowOrchestrator orchestrator;

    public ChatController(WorkflowOrchestrator orchestrator) {
        this.orchestrator = orchestrator;
    }

    @PostMapping("/chat")
    public ResponseEntity<ChatResponse> chat(@Valid @RequestBody ChatRequest request) {
        ChatResponse response = orchestrator.process(request);
        return ResponseEntity.ok(response);
    }
}
