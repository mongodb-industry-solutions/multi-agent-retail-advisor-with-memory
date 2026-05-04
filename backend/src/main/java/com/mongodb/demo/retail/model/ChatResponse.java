package com.mongodb.demo.retail.model;

public record ChatResponse(
        String reply,
        String sessionId,
        int toolCallCount
) {}
