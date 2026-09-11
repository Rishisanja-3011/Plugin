FROM maven:3.9.11-eclipse-temurin-17 AS build
WORKDIR /app

COPY pom.xml .
COPY src ./src

RUN mvn --batch-mode --no-transfer-progress clean verify

FROM eclipse-temurin:25-jre-jammy
RUN groupadd --system --gid 10001 plugin \
    && useradd --system --uid 10001 --gid plugin --home-dir /nonexistent --shell /usr/sbin/nologin plugin
WORKDIR /app
ENV TZ=Asia/Kolkata \
    SERVER_PORT=8091

COPY --from=build --chown=plugin:plugin /app/target/*.jar /app/app.jar

USER 10001:10001
EXPOSE 8091
ENTRYPOINT ["java", "-Duser.timezone=Asia/Kolkata", "-jar", "/app/app.jar"]
