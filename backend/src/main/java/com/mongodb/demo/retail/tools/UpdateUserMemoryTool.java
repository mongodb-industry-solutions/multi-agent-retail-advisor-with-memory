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
import com.mongodb.client.model.UpdateOptions;
import com.mongodb.client.model.Updates;
import com.mongodb.demo.retail.config.AgentContext;
import com.mongodb.demo.retail.mongodb.MongoCollections;
import com.mongodb.demo.retail.mongodb.ToolInvocationRepository;
import io.reactivex.rxjava3.core.Single;
import org.bson.Document;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@Component
public class UpdateUserMemoryTool extends BaseTool {

    private static final Logger log = LoggerFactory.getLogger(UpdateUserMemoryTool.class);

    private final MongoCollection<Document> userMemory;
    private final ToolInvocationRepository toolInvocationRepo;
    private final ObjectMapper objectMapper;

    public UpdateUserMemoryTool(MongoClient mongoClient,
                                ToolInvocationRepository toolInvocationRepo,
                                @Value("${mongodb.database}") String database) {
        super("update_user_memory",
              "Persist new facts about the user into long-term memory. " +
              "Call this when you learn something meaningful: a new preference, size, brand interest, activity, or budget constraint.");
        this.userMemory = mongoClient.getDatabase(database).getCollection(MongoCollections.USER_MEMORY);
        this.toolInvocationRepo = toolInvocationRepo;
        this.objectMapper = new ObjectMapper();
    }

    @Override
    public Optional<FunctionDeclaration> declaration() {
        return Optional.of(FunctionDeclaration.builder()
            .name("update_user_memory")
            .description("Persist new facts about the user into long-term memory.")
            .parameters(Schema.builder()
                .type(new Type(Type.Known.OBJECT))
                .properties(Map.of(
                    "user_id", Schema.builder()
                        .type(new Type(Type.Known.STRING))
                        .description("The user's unique identifier")
                        .build(),
                    "new_facts", Schema.builder()
                        .type(new Type(Type.Known.ARRAY))
                        .items(Schema.builder()
                            .type(new Type(Type.Known.STRING))
                            .build())
                        .description("List of concise fact strings to add to the user's long-term memory")
                        .build()
                ))
                .required(List.of("user_id", "new_facts"))
                .build())
            .build());
    }

    @Override
    @SuppressWarnings("unchecked")
    public Single<Map<String, Object>> runAsync(Map<String, Object> args, ToolContext toolContext) {
        long start = System.currentTimeMillis();
        String userId = (String) args.getOrDefault("user_id", "");
        String inputJson;
        try { inputJson = objectMapper.writeValueAsString(args); }
        catch (Exception e) { inputJson = args.toString(); }

        String result;
        String error = null;
        try {
            List<String> facts = new ArrayList<>();
            Object rawFacts = args.get("new_facts");
            if (rawFacts instanceof List<?> list) {
                list.forEach(item -> facts.add(String.valueOf(item)));
            }

            userMemory.updateOne(
                    Filters.eq("user_id", userId),
                    Updates.combine(
                            Updates.pushEach("facts", facts),
                            Updates.set("updated_at", Date.from(Instant.now()))
                    ),
                    new UpdateOptions().upsert(true)
            );

            result = "{\"status\": \"ok\", \"user_id\": \"" + userId +
                     "\", \"facts_added\": " + facts.size() + "}";
        } catch (Exception e) {
            log.error("update_user_memory failed: {}", e.getMessage(), e);
            error = e.getMessage();
            result = "{\"error\": \"Failed to update user memory\"}";
        }

        long latency = System.currentTimeMillis() - start;
        String sessionId = AgentContext.getSessionId();
        if (sessionId != null) {
            toolInvocationRepo.log(sessionId, "ProfileAgent", "update_user_memory", inputJson, result, latency, error);
        }
        log.info("[ProfileAgent] update_user_memory | {}ms", latency);
        return Single.just(Map.of("result", result));
    }
}
