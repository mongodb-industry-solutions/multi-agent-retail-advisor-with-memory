package com.mongodb.demo.retail.mongodb;

import com.mongodb.client.MongoClient;
import com.mongodb.client.MongoCollection;
import com.mongodb.client.model.Filters;
import com.mongodb.client.model.Sorts;
import org.bson.Document;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;

@Repository
public class ToolInvocationRepository {

    private final MongoCollection<Document> collection;

    public ToolInvocationRepository(MongoClient mongoClient,
                                    @Value("${mongodb.database}") String database) {
        this.collection = mongoClient.getDatabase(database)
                .getCollection(MongoCollections.TOOL_INVOCATIONS);
    }

    public void log(String sessionId, String agentName, String toolName,
                    String input, String output, long latencyMs, String error) {
        Document doc = new Document()
                .append("session_id", sessionId)
                .append("agent_name", agentName)
                .append("tool_name", toolName)
                .append("input", input)
                .append("output", output)
                .append("latency_ms", latencyMs)
                .append("timestamp", Date.from(Instant.now()));
        if (error != null) {
            doc.append("error", error);
        }
        collection.insertOne(doc);
    }

    public List<Document> findBySessionId(String sessionId) {
        List<Document> results = new ArrayList<>();
        collection.find(Filters.eq("session_id", sessionId))
                .sort(Sorts.ascending("timestamp"))
                .into(results);
        return results;
    }
}
