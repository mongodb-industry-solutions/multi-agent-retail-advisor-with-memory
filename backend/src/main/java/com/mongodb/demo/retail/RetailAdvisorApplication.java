package com.mongodb.demo.retail;

import io.github.cdimascio.dotenv.Dotenv;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
public class RetailAdvisorApplication {

    public static void main(String[] args) {
        // Load .env file for local development (silently ignored in production)
        try {
            Dotenv dotenv = Dotenv.configure().ignoreIfMissing().load();
            dotenv.entries().forEach(entry ->
                    System.setProperty(entry.getKey(), entry.getValue())
            );
        } catch (Exception ignored) {}

        SpringApplication.run(RetailAdvisorApplication.class, args);
    }
}
