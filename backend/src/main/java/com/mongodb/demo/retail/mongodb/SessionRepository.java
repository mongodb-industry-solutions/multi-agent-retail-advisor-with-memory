package com.mongodb.demo.retail.mongodb;

import com.mongodb.client.MongoClient;
import com.mongodb.client.MongoCollection;
import com.mongodb.client.model.Filters;
import com.mongodb.client.model.Updates;
import org.bson.Document;
import org.bson.types.ObjectId;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.Date;
import java.util.Map;

@Repository
public class SessionRepository {

    private final MongoCollection<Document> collection;

    public SessionRepository(MongoClient mongoClient,
                             @Value("${mongodb.database}") String database) {
        this.collection = mongoClient.getDatabase(database)
                .getCollection(MongoCollections.SESSIONS);
    }

    public void initSession(String sessionId, String userId) {
        Document existing = collection.find(Filters.eq("session_id", sessionId)).first();
        if (existing == null) {
            Document doc = new Document()
                    .append("session_id", sessionId)
                    .append("user_id", userId)
                    .append("messages", new java.util.ArrayList<>())
                    .append("created_at", Date.from(Instant.now()))
                    .append("updated_at", Date.from(Instant.now()));
            collection.insertOne(doc);
        }
    }

    public void appendMessage(String sessionId, String role, String content) {
        Document message = new Document()
                .append("role", role)
                .append("content", content)
                .append("timestamp", Date.from(Instant.now()));

        collection.updateOne(
                Filters.eq("session_id", sessionId),
                Updates.combine(
                        Updates.push("messages", message),
                        Updates.set("updated_at", Date.from(Instant.now()))
                )
        );
    }

    public Document findBySessionId(String sessionId) {
        return collection.find(Filters.eq("session_id", sessionId)).first();
    }
}
