package com.mongodb.demo.retail.mongodb;

import com.mongodb.client.MongoClient;
import com.mongodb.client.MongoCollection;
import com.mongodb.client.model.Filters;
import com.mongodb.client.model.Updates;
import org.bson.Document;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.Date;
import java.util.Map;

@Repository
public class AgentStateRepository {

    private final MongoCollection<Document> collection;

    public AgentStateRepository(MongoClient mongoClient,
                                @Value("${mongodb.database}") String database) {
        this.collection = mongoClient.getDatabase(database)
                .getCollection(MongoCollections.AGENT_STATE);
    }

    public void create(String sessionId, String workflowType) {
        Document doc = new Document()
                .append("session_id", sessionId)
                .append("workflow_type", workflowType)
                .append("status", "running")
                .append("current_step", "initializing")
                .append("context", new Document())
                .append("created_at", Date.from(Instant.now()))
                .append("updated_at", Date.from(Instant.now()));
        collection.insertOne(doc);
    }

    public void updateStep(String sessionId, String step) {
        collection.updateOne(
                Filters.eq("session_id", sessionId),
                Updates.combine(
                        Updates.set("current_step", step),
                        Updates.set("updated_at", Date.from(Instant.now()))
                )
        );
    }

    public void complete(String sessionId, Map<String, Object> context) {
        Document contextDoc = new Document(context);
        collection.updateOne(
                Filters.eq("session_id", sessionId),
                Updates.combine(
                        Updates.set("status", "completed"),
                        Updates.set("current_step", "done"),
                        Updates.set("context", contextDoc),
                        Updates.set("updated_at", Date.from(Instant.now()))
                )
        );
    }

    public void fail(String sessionId, String errorMessage) {
        collection.updateOne(
                Filters.eq("session_id", sessionId),
                Updates.combine(
                        Updates.set("status", "failed"),
                        Updates.set("error", errorMessage),
                        Updates.set("updated_at", Date.from(Instant.now()))
                )
        );
    }

    public Document findBySessionId(String sessionId) {
        return collection.find(Filters.eq("session_id", sessionId)).first();
    }
}
