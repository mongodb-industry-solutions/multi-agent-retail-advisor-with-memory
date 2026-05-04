package com.mongodb.demo.retail.tools;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.google.adk.tools.BaseTool;
import com.google.adk.tools.ToolContext;
import com.google.genai.types.FunctionDeclaration;
import com.google.genai.types.Schema;
import com.google.genai.types.Type;
import com.mongodb.client.MongoClient;
import com.mongodb.client.MongoCollection;
import com.mongodb.client.model.Filters;
import com.mongodb.demo.retail.config.AgentContext;
import com.mongodb.demo.retail.mongodb.MongoCollections;
import com.mongodb.demo.retail.mongodb.ToolInvocationRepository;
import io.reactivex.rxjava3.core.Single;
import org.bson.Document;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@Component
public class GetUserMemoryTool extends BaseTool {

    private static final Logger log = LoggerFactory.getLogger(GetUserMemoryTool.class);

    private final MongoCollection<Document> userMemory;
    private final ToolInvocationRepository toolInvocationRepo;
    private final ObjectMapper objectMapper;

    public GetUserMemoryTool(MongoClient mongoClient,
                             ToolInvocationRepository toolInvocationRepo,
                             @Value("${mongodb.database}") String database) {
        super("get_user_memory",
              "Retrieve long-term memory facts about a user — past preferences, purchase history hints, stated interests, and prior interaction context.");
        this.userMemory = mongoClient.getDatabase(database).getCollection(MongoCollections.USER_MEMORY);
        this.toolInvocationRepo = toolInvocationRepo;
        this.objectMapper = new ObjectMapper();
    }

    @Override
    public Optional<FunctionDeclaration> declaration() {
        return Optional.of(FunctionDeclaration.builder()
            .name("get_user_memory")
            .description("Retrieve long-term memory facts about a user.")
            .parameters(Schema.builder()
                .type(new Type(Type.Known.OBJECT))
                .properties(Map.of(
                    "user_id", Schema.builder()
                        .type(new Type(Type.Known.STRING))
                        .description("The user's unique identifier")
                        .build()
                ))
                .required(List.of("user_id"))
                .build())
            .build());
    }

    @Override
    public Single<Map<String, Object>> runAsync(Map<String, Object> args, ToolContext toolContext) {
        long start = System.currentTimeMillis();
        String userId = (String) args.getOrDefault("user_id", "");
        String inputJson;
        try { inputJson = objectMapper.writeValueAsString(args); }
        catch (Exception e) { inputJson = args.toString(); }

        String result;
        String error = null;
        try {
            List<Document> memories = new ArrayList<>();
            userMemory.find(Filters.eq("user_id", userId)).into(memories);

            if (memories.isEmpty()) {
                result = "{\"user_id\": \"" + userId + "\", \"facts\": [], \"note\": \"No memory stored for this user yet\"}";
            } else {
                Document memory = memories.get(0);
                memory.remove("_id");
                result = objectMapper.writeValueAsString(memory);
            }
        } catch (Exception e) {
            log.error("get_user_memory failed: {}", e.getMessage(), e);
            error = e.getMessage();
            result = "{\"error\": \"Failed to retrieve user memory\"}";
        }

        long latency = System.currentTimeMillis() - start;
        String sessionId = AgentContext.getSessionId();
        if (sessionId != null) {
            toolInvocationRepo.log(sessionId, "ProfileAgent", "get_user_memory", inputJson, result, latency, error);
        }
        log.info("[ProfileAgent] get_user_memory | {}ms", latency);
        return Single.just(Map.of("result", result));
    }
}
