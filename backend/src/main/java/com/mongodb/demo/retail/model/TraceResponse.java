package com.mongodb.demo.retail.model;

import java.util.List;
import java.util.Map;

public record TraceResponse(
        Map<String, Object> session,
        Map<String, Object> agentState,
        List<Map<String, Object>> toolInvocations
) {}
