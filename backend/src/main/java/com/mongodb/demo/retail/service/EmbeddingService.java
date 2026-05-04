package com.mongodb.demo.retail.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import okhttp3.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.util.ArrayList;
import java.util.List;

@Service
public class EmbeddingService {

    private static final Logger log = LoggerFactory.getLogger(EmbeddingService.class);
    private static final String VOYAGE_ENDPOINT = "https://ai.mongodb.com/v1/embeddings";
    private static final MediaType JSON = MediaType.parse("application/json; charset=utf-8");

    private final OkHttpClient httpClient;
    private final ObjectMapper objectMapper;
    private final String apiKey;
    private final String model;

    public EmbeddingService(OkHttpClient httpClient,
                            @Value("${voyage.api-key}") String apiKey,
                            @Value("${voyage.model}") String model) {
        this.httpClient = httpClient;
        this.objectMapper = new ObjectMapper();
        this.apiKey = apiKey;
        this.model = model;
    }

    public List<Float> embed(String text) {
        return embedBatch(List.of(text)).get(0);
    }

    public List<List<Float>> embedBatch(List<String> texts) {
        try {
            ObjectNode body = objectMapper.createObjectNode();
            body.put("model", model);
            ArrayNode inputArray = body.putArray("input");
            texts.forEach(inputArray::add);
            body.put("input_type", "document");

            Request request = new Request.Builder()
                    .url(VOYAGE_ENDPOINT)
                    .header("Authorization", "Bearer " + apiKey)
                    .post(RequestBody.create(objectMapper.writeValueAsString(body), JSON))
                    .build();

            try (Response response = httpClient.newCall(request).execute()) {
                if (!response.isSuccessful()) {
                    String errorBody = response.body() != null ? response.body().string() : "no body";
                    throw new RuntimeException("Voyage AI error " + response.code() + ": " + errorBody);
                }
                JsonNode responseJson = objectMapper.readTree(response.body().string());
                JsonNode data = responseJson.get("data");

                List<List<Float>> embeddings = new ArrayList<>();
                for (JsonNode item : data) {
                    List<Float> vector = new ArrayList<>();
                    for (JsonNode val : item.get("embedding")) {
                        vector.add(val.floatValue());
                    }
                    embeddings.add(vector);
                }
                return embeddings;
            }
        } catch (IOException e) {
            throw new RuntimeException("Failed to generate embeddings", e);
        }
    }

    public List<Float> embedQuery(String queryText) {
        try {
            ObjectNode body = objectMapper.createObjectNode();
            body.put("model", model);
            ArrayNode inputArray = body.putArray("input");
            inputArray.add(queryText);
            body.put("input_type", "query");

            Request request = new Request.Builder()
                    .url(VOYAGE_ENDPOINT)
                    .header("Authorization", "Bearer " + apiKey)
                    .post(RequestBody.create(objectMapper.writeValueAsString(body), JSON))
                    .build();

            try (Response response = httpClient.newCall(request).execute()) {
                if (!response.isSuccessful()) {
                    String errorBody = response.body() != null ? response.body().string() : "no body";
                    throw new RuntimeException("Voyage AI query error " + response.code() + ": " + errorBody);
                }
                JsonNode responseJson = objectMapper.readTree(response.body().string());
                JsonNode embedding = responseJson.get("data").get(0).get("embedding");
                List<Float> vector = new ArrayList<>();
                for (JsonNode val : embedding) {
                    vector.add(val.floatValue());
                }
                return vector;
            }
        } catch (IOException e) {
            throw new RuntimeException("Failed to generate query embedding", e);
        }
    }
}
