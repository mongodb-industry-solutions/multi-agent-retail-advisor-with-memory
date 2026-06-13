package com.mongodb.demo.retail.model;

import java.util.Map;

public record ProfileResponse(
        Map<String, Object> user,
        Map<String, Object> memory
) {}
