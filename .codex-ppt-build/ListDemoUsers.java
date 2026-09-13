import com.mongodb.client.MongoClients;
import org.bson.Document;

public class ListDemoUsers {
    public static void main(String[] args) {
        String uri = System.getenv("MONGODB_URI");
        String database = System.getenv().getOrDefault("MONGODB_DATABASE", "plugin");
        if (uri == null || uri.isBlank()) throw new IllegalStateException("MONGODB_URI missing");
        try (var client = MongoClients.create(uri)) {
            for (Document user : client.getDatabase(database).getCollection("users")
                    .find(new Document("role", new Document("$in", java.util.List.of("ADMIN", "GRID_OPERATOR", "STATION_OPERATOR"))))) {
                System.out.println(user.getString("email") + "\t" + user.getString("role") + "\t" + user.getString("fullName"));
            }
        }
    }
}
