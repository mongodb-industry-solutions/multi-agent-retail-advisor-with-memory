package com.mongodb.demo.retail.model;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record ChatRequest(

        @NotBlank(message = "userId is required")
        @Size(max = 50, message = "userId must be 50 characters or fewer")
        @Pattern(regexp = "^[a-zA-Z0-9_-]+$", message = "userId may only contain letters, digits, hyphens, and underscores")
        String userId,

        @NotBlank(message = "message is required")
        @Size(max = 2000, message = "message must be 2000 characters or fewer")
        String message,

        @Pattern(regexp = "^[0-9a-fA-F-]{36}$", message = "sessionId must be a valid UUID")
        String sessionId

) {}
