package com.mongodb.demo.retail.tools;

import com.fasterxml.jackson.databind.node.ObjectNode;

public interface AgentTool {
    String name();
    String description();
    String inputSchema();
    String execute(ObjectNode input);
}
