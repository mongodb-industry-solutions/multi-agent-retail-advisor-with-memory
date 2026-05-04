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

import java.util.Map;
import java.util.Optional;

@Component
public class GetUserProfileTool extends BaseTool {

    private static final Logger log = LoggerFactory.getLogger(GetUserProfileTool.class);

    private final MongoCollection<Document> users;
    private final ToolInvocationRepository toolInvocationRepo;
    private final ObjectMapper objectMapper;

    public GetUserProfileTool(MongoClient mongoClient,
                              ToolInvocationRepository toolInvocationRepo,
                              @Value("${mongodb.database}") String database) {
        super("get_user_profile",
              "Retrieve a user's profile including their preferences, sizes, experience level, and favorite brands.");
        this.users = mongoClient.getDatabase(database).getCollection(MongoCollections.USERS);
        this.toolInvocationRepo = toolInvocationRepo;
        this.objectMapper = new ObjectMapper();
    }

    @Override
    public Optional<FunctionDeclaration> declaration() {
        return Optional.of(FunctionDeclaration.builder()
            .name("get_user_profile")
            .description("Retrieve a user's profile including their preferences, sizes, experience level, and favorite brands.")
            .parameters(Schema.builder()
                .type(new Type(Type.Known.OBJECT))
                .properties(Map.of(
                    "user_id", Schema.builder()
                        .type(new Type(Type.Known.STRING))
                        .description("The user's unique identifier")
                        .build()
                ))
                .required(java.util.List.of("user_id"))
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
            Document user = users.find(Filters.eq("_id", userId)).first();
            if (user == null) {
                result = "{\"error\": \"User not found\"}";
            } else {
                user.remove("_id");
                result = objectMapper.writeValueAsString(user);
            }
        } catch (Exception e) {
            log.error("get_user_profile failed: {}", e.getMessage(), e);
            error = e.getMessage();
            result = "{\"error\": \"Failed to retrieve user profile\"}";
        }

        long latency = System.currentTimeMillis() - start;
        String sessionId = AgentContext.getSessionId();
        if (sessionId != null) {
            toolInvocationRepo.log(sessionId, "ProfileAgent", "get_user_profile", inputJson, result, latency, error);
        }
        log.info("[ProfileAgent] get_user_profile | {}ms", latency);
        return Single.just(Map.of("result", result));
    }
}
