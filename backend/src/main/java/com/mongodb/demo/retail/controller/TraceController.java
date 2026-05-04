package com.mongodb.demo.retail.controller;

import com.mongodb.demo.retail.model.TraceResponse;
import com.mongodb.demo.retail.orchestration.WorkflowOrchestrator;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api")
public class TraceController {

    private final WorkflowOrchestrator orchestrator;

    public TraceController(WorkflowOrchestrator orchestrator) {
        this.orchestrator = orchestrator;
    }

    @GetMapping("/trace/{sessionId}")
    public ResponseEntity<TraceResponse> getTrace(@PathVariable String sessionId) {
        return ResponseEntity.ok(orchestrator.getTrace(sessionId));
    }
}
