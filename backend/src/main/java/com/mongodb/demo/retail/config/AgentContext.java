package com.mongodb.demo.retail.config;

public class AgentContext {

    private static final ThreadLocal<String> SESSION_ID = new ThreadLocal<>();

    public static void setSessionId(String sessionId) {
        SESSION_ID.set(sessionId);
    }

    public static String getSessionId() {
        return SESSION_ID.get();
    }

    public static void clear() {
        SESSION_ID.remove();
    }
}
