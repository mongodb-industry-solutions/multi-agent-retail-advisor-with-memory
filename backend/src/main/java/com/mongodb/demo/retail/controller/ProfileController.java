package com.mongodb.demo.retail.controller;

import com.mongodb.client.MongoClient;
import com.mongodb.client.MongoCollection;
import com.mongodb.client.model.Filters;
import com.mongodb.demo.retail.model.ProfileResponse;
import com.mongodb.demo.retail.mongodb.MongoCollections;
import org.bson.Document;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Collections;
import java.util.Map;

@RestController
@RequestMapping("/api")
public class ProfileController {

    private final MongoCollection<Document> users;
    private final MongoCollection<Document> userMemory;

    public ProfileController(MongoClient mongoClient,
                             @Value("${mongodb.database}") String database) {
        this.users = mongoClient.getDatabase(database).getCollection(MongoCollections.USERS);
        this.userMemory = mongoClient.getDatabase(database).getCollection(MongoCollections.USER_MEMORY);
    }

    @GetMapping("/profile/{userId}")
    public ResponseEntity<ProfileResponse> getProfile(@PathVariable String userId) {
        Document userDoc = users.find(Filters.eq("_id", userId)).first();
        Map<String, Object> user = userDoc != null ? userDoc : Collections.emptyMap();

        Document memoryDoc = userMemory.find(Filters.eq("user_id", userId)).first();
        Map<String, Object> memory = memoryDoc != null ? memoryDoc : Collections.emptyMap();

        return ResponseEntity.ok(new ProfileResponse(user, memory));
    }
}
