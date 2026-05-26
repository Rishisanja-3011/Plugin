FROM maven:3.9-eclipse-temurin-17 AS build
WORKDIR /app

COPY pom.xml .
COPY src ./src

RUN mvn clean package -DskipTests

FROM eclipse-temurin:17-jre
WORKDIR /app
ENV TZ=Asia/Kolkata

COPY --from=build /app/target/*.jar app.jar

CMD ["sh", "-c", "java -Duser.timezone=${TZ:-Asia/Kolkata} -Dserver.port=$PORT -jar /app/app.jar"]
