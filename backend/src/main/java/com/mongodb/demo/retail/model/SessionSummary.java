package com.mongodb.demo.retail.model;

public record SessionSummary(
        String sessionId,
        String preview,
        int messageCount,
        String createdAt,
        String updatedAt,
        boolean starred
) {}
