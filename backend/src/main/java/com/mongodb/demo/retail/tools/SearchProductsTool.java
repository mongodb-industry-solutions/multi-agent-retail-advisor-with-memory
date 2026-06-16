package com.mongodb.demo.retail.tools;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.google.adk.tools.BaseTool;
import com.google.adk.tools.ToolContext;
import com.google.genai.types.FunctionDeclaration;
import com.google.genai.types.Schema;
import com.google.genai.types.Type;
import com.mongodb.client.MongoClient;
import com.mongodb.client.MongoCollection;
import com.mongodb.client.model.Aggregates;
import com.mongodb.client.model.Filters;
import com.mongodb.client.model.Projections;
import com.mongodb.demo.retail.config.AgentContext;
import com.mongodb.demo.retail.mongodb.MongoCollections;
import com.mongodb.demo.retail.mongodb.ToolInvocationRepository;
import io.reactivex.rxjava3.core.Single;
import org.bson.Document;
import org.bson.conversions.Bson;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@Component
public class SearchProductsTool extends BaseTool {

    private static final Logger log = LoggerFactory.getLogger(SearchProductsTool.class);

    private final MongoCollection<Document> products;
    private final ToolInvocationRepository toolInvocationRepo;
    private final ObjectMapper objectMapper;

    public SearchProductsTool(MongoClient mongoClient,
                              ToolInvocationRepository toolInvocationRepo,
                              @Value("${mongodb.database}") String database) {
        super("search_products",
              "Search the product catalog using semantic vector search combined with structured filters. " +
              "Returns the most relevant products matching the query and filters.");
        this.products = mongoClient.getDatabase(database).getCollection(MongoCollections.PRODUCTS);
        this.toolInvocationRepo = toolInvocationRepo;
        this.objectMapper = new ObjectMapper();
    }

    @Override
    public Optional<FunctionDeclaration> declaration() {
        return Optional.of(FunctionDeclaration.builder()
            .name("search_products")
            .description("Search the product catalog using semantic vector search combined with structured filters.")
            .parameters(Schema.builder()
                .type(new Type(Type.Known.OBJECT))
                .properties(Map.of(
                    "query", Schema.builder()
                        .type(new Type(Type.Known.STRING))
                        .description("Natural language search query for product discovery")
                        .build(),
                    "max_price", Schema.builder()
                        .type(new Type(Type.Known.NUMBER))
                        .description("Maximum price in USD (optional)")
                        .nullable(true)
                        .build(),
                    "size", Schema.builder()
                        .type(new Type(Type.Known.STRING))
                        .description("Shoe size or clothing size (optional, e.g. '10' or 'M')")
                        .nullable(true)
                        .build(),
                    "waterproof", Schema.builder()
                        .type(new Type(Type.Known.BOOLEAN))
                        .description("Filter for waterproof products (optional)")
                        .nullable(true)
                        .build(),
                    "eco_friendly", Schema.builder()
                        .type(new Type(Type.Known.BOOLEAN))
                        .description("Filter for eco-friendly / sustainable products (optional)")
                        .nullable(true)
                        .build(),
                    "category", Schema.builder()
                        .type(new Type(Type.Known.STRING))
                        .description("Product category slug (optional): rain_jackets, fleece_jackets, down_jackets, softshell_jackets, hiking_pants, trail_shorts, base_layers, hiking_boots, trail_shoes, approach_shoes, sandals, backpacks, trekking_poles, headlamps, socks, sleeping_bags, gloves_headwear")
                        .nullable(true)
                        .build()
                ))
                .required("query")
                .build())
            .build());
    }

    @Override
    public Single<Map<String, Object>> runAsync(Map<String, Object> args, ToolContext toolContext) {
        long start = System.currentTimeMillis();
        String inputJson;
        try { inputJson = objectMapper.writeValueAsString(args); }
        catch (Exception e) { inputJson = args.toString(); }

        String result;
        String error = null;
        try {
            String query = (String) args.getOrDefault("query", "");
            Double maxPrice = args.get("max_price") instanceof Number
                ? ((Number) args.get("max_price")).doubleValue() : null;
            String size = args.get("size") instanceof String ? (String) args.get("size") : null;
            Boolean waterproof = args.get("waterproof") instanceof Boolean
                ? (Boolean) args.get("waterproof") : null;
            Boolean ecoFriendly = args.get("eco_friendly") instanceof Boolean
                ? (Boolean) args.get("eco_friendly") : null;
            String category = args.get("category") instanceof String ? (String) args.get("category") : null;

            try {
                result = vectorSearch(query, maxPrice, size, waterproof, ecoFriendly, category);
            } catch (Exception e) {
                log.warn("Vector search failed, falling back to text search: {}", e.getMessage());
                result = textSearch(query, maxPrice, size, waterproof, ecoFriendly, category);
            }
        } catch (Exception e) {
            log.error("search_products failed: {}", e.getMessage(), e);
            error = e.getMessage();
            result = "{\"error\": \"Product search failed\"}";
        }

        long latency = System.currentTimeMillis() - start;
        String sessionId = AgentContext.getSessionId();
        if (sessionId != null) {
            toolInvocationRepo.log(sessionId, "ProductAgent", "search_products", inputJson, result, latency, error);
        }
        log.info("[ProductAgent] search_products | {}ms", latency);
        return Single.just(Map.of("result", result));
    }

    private String vectorSearch(String query, Double maxPrice, String size,
                                Boolean waterproof, Boolean ecoFriendly, String category) {
        List<Bson> preFilters = buildFilters(maxPrice, size, waterproof, ecoFriendly, category);

        Document vectorSearchDoc = new Document()
                .append("index", MongoCollections.VECTOR_INDEX_NAME)
                .append("path", "search_text")
                .append("query", query)
                .append("numCandidates", 200)
                .append("limit", 5L);

        if (!preFilters.isEmpty()) {
            vectorSearchDoc.append("filter", Filters.and(preFilters));
        }

        List<Bson> pipeline = new ArrayList<>();
        pipeline.add(new Document("$vectorSearch", vectorSearchDoc));
        pipeline.add(Aggregates.project(Projections.metaVectorSearchScore("score")));

        return executeAndSerialize(pipeline);
    }

    private String textSearch(String query, Double maxPrice, String size,
                              Boolean waterproof, Boolean ecoFriendly, String category) {
        List<Bson> filters = buildFilters(maxPrice, size, waterproof, ecoFriendly, category);

        List<Bson> pipeline = new ArrayList<>();
        var searchStage = new Document("$search", new Document()
                .append("index", MongoCollections.SEARCH_INDEX_NAME)
                .append("compound", new Document()
                        .append("should", List.of(
                                new Document("text", new Document()
                                        .append("query", query)
                                        .append("path", List.of("name", "description", "brand")))
                        ))
                ));
        pipeline.add(searchStage);
        if (!filters.isEmpty()) {
            pipeline.add(Aggregates.match(Filters.and(filters)));
        }
        pipeline.add(Aggregates.limit(5));
        return executeAndSerialize(pipeline);
    }

    private List<Bson> buildFilters(Double maxPrice, String size,
                                    Boolean waterproof, Boolean ecoFriendly, String category) {
        List<Bson> filters = new ArrayList<>();
        if (maxPrice != null) filters.add(Filters.lte("price", maxPrice));
        if (size != null) filters.add(Filters.eq("size_options", size));
        if (Boolean.TRUE.equals(waterproof)) filters.add(Filters.eq("attributes.waterproof", true));
        if (Boolean.TRUE.equals(ecoFriendly)) filters.add(Filters.eq("attributes.eco_friendly", true));
        if (category != null) filters.add(Filters.eq("category", category));
        return filters;
    }

    private String executeAndSerialize(List<Bson> pipeline) {
        List<Document> results = new ArrayList<>();
        products.aggregate(pipeline).into(results);
        results.forEach(doc -> doc.remove("_id"));
        try {
            return objectMapper.writeValueAsString(results);
        } catch (Exception e) {
            return results.toString();
        }
    }
}
