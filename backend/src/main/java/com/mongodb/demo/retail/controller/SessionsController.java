package com.mongodb.demo.retail.controller;

import com.mongodb.client.MongoClient;
import com.mongodb.client.MongoCollection;
import com.mongodb.client.model.Filters;
import com.mongodb.client.model.Sorts;
import com.mongodb.client.model.Updates;
import com.mongodb.demo.retail.model.SessionSummary;
import com.mongodb.demo.retail.mongodb.MongoCollections;
import org.bson.Document;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.ArrayList;
import java.util.List;

@RestController
@RequestMapping("/api")
public class SessionsController {

    private final MongoCollection<Document> sessions;

    public SessionsController(MongoClient mongoClient,
                              @Value("${mongodb.database}") String database) {
        this.sessions = mongoClient.getDatabase(database).getCollection(MongoCollections.SESSIONS);
    }

    @GetMapping("/sessions/user/{userId}")
    public ResponseEntity<List<SessionSummary>> listUserSessions(@PathVariable String userId) {
        List<SessionSummary> result = new ArrayList<>();

        sessions.find(Filters.eq("user_id", userId))
                .sort(Sorts.descending("updated_at"))
                .limit(20)
                .forEach(doc -> {
                    String sessionId = doc.getString("session_id");
                    List<Document> messages = doc.getList("messages", Document.class);
                    int messageCount = messages != null ? messages.size() : 0;
                    boolean starred = Boolean.TRUE.equals(doc.getBoolean("starred"));

                    String preview = "";
                    if (messages != null) {
                        for (Document msg : messages) {
                            if ("user".equals(msg.getString("role"))) {
                                String content = msg.getString("content");
                                if (content != null) {
                                    preview = content.length() > 120 ? content.substring(0, 120) + "…" : content;
                                }
                                break;
                            }
                        }
                    }

                    Object createdAt = doc.get("created_at");
                    Object updatedAt = doc.get("updated_at");

                    result.add(new SessionSummary(
                            sessionId,
                            preview,
                            messageCount,
                            createdAt != null ? createdAt.toString() : "",
                            updatedAt != null ? updatedAt.toString() : "",
                            starred
                    ));
                });

        return ResponseEntity.ok(result);
    }

    @PutMapping("/sessions/{sessionId}/star")
    public ResponseEntity<Void> starSession(
            @PathVariable String sessionId,
            @RequestParam boolean starred) {
        sessions.updateOne(
                Filters.eq("session_id", sessionId),
                Updates.set("starred", starred)
        );
        return ResponseEntity.noContent().build();
    }
}
