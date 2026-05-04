package com.mongodb.demo.retail.orchestration;

import com.mongodb.demo.retail.agents.PlannerAgent;
import com.mongodb.demo.retail.model.ChatRequest;
import com.mongodb.demo.retail.model.ChatResponse;
import com.mongodb.demo.retail.model.TraceResponse;
import com.mongodb.demo.retail.mongodb.AgentStateRepository;
import com.mongodb.demo.retail.mongodb.SessionRepository;
import com.mongodb.demo.retail.mongodb.ToolInvocationRepository;
import org.bson.Document;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
public class WorkflowOrchestrator {

    private static final Logger log = LoggerFactory.getLogger(WorkflowOrchestrator.class);

    private final PlannerAgent plannerAgent;
    private final SessionRepository sessionRepo;
    private final AgentStateRepository agentStateRepo;
    private final ToolInvocationRepository toolInvocationRepo;

    public WorkflowOrchestrator(PlannerAgent plannerAgent,
                                SessionRepository sessionRepo,
                                AgentStateRepository agentStateRepo,
                                ToolInvocationRepository toolInvocationRepo) {
        this.plannerAgent = plannerAgent;
        this.sessionRepo = sessionRepo;
        this.agentStateRepo = agentStateRepo;
        this.toolInvocationRepo = toolInvocationRepo;
    }

    public ChatResponse process(ChatRequest request) {
        String sessionId = (request.sessionId() != null && !request.sessionId().isBlank())
                ? request.sessionId()
                : UUID.randomUUID().toString();

        log.info("Processing request for user={} session={}", request.userId(), sessionId);

        sessionRepo.initSession(sessionId, request.userId());
        sessionRepo.appendMessage(sessionId, "user", request.message());
        agentStateRepo.create(sessionId, "product_advisor");
        agentStateRepo.updateStep(sessionId, "planning");

        String fullInput = String.format(
                "User ID: %s\nUser message: %s",
                request.userId(), request.message()
        );

        String reply;
        try {
            agentStateRepo.updateStep(sessionId, "executing");
            reply = plannerAgent.run(fullInput, request.userId(), sessionId);
            agentStateRepo.updateStep(sessionId, "synthesizing");
        } catch (Exception e) {
            log.error("Workflow failed for session {}: {}", sessionId, e.getMessage(), e);
            agentStateRepo.fail(sessionId, e.getMessage());
            reply = "I'm sorry, I encountered an issue while processing your request. Please try again.";
        }

        sessionRepo.appendMessage(sessionId, "assistant", reply);

        int toolCallCount = toolInvocationRepo.findBySessionId(sessionId).size();
        agentStateRepo.complete(sessionId, Map.of(
                "tool_calls", toolCallCount,
                "agents_invoked", List.of("PlannerAgent", "ProductAgent", "ProfileAgent")
        ));

        log.info("Completed session={} toolCalls={}", sessionId, toolCallCount);
        return new ChatResponse(reply, sessionId, toolCallCount);
    }

    public TraceResponse getTrace(String sessionId) {
        Document session = sessionRepo.findBySessionId(sessionId);
        Document agentState = agentStateRepo.findBySessionId(sessionId);
        List<Document> toolInvocations = toolInvocationRepo.findBySessionId(sessionId);

        return new TraceResponse(
                session != null ? docToMap(session) : Map.of(),
                agentState != null ? docToMap(agentState) : Map.of(),
                toolInvocations.stream().map(this::docToMap).toList()
        );
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> docToMap(Document doc) {
        Document copy = new Document(doc);
        copy.remove("_id");
        return (Map<String, Object>) (Map<?, ?>) copy;
    }
}
