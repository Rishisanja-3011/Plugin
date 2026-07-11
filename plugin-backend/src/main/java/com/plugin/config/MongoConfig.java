package com.plugin.config;

import lombok.extern.slf4j.Slf4j;
import org.bson.Document;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.convert.converter.Converter;
import org.springframework.dao.DataAccessException;
import org.springframework.data.convert.ReadingConverter;
import org.springframework.data.mongodb.MongoDatabaseFactory;
import org.springframework.data.mongodb.MongoTransactionManager;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.convert.MongoCustomConversions;
import org.springframework.data.mongodb.core.index.CompoundIndexDefinition;
import org.springframework.data.mongodb.core.index.Index;

import java.time.LocalTime;
import java.util.List;

@Configuration
@Slf4j
public class MongoConfig {

    @Bean
    public MongoTransactionManager transactionManager(MongoDatabaseFactory databaseFactory) {
        return new MongoTransactionManager(databaseFactory);
    }

    @Bean
    public MongoCustomConversions mongoCustomConversions() {
        return new MongoCustomConversions(List.of(
                new IntegerToBooleanConverter(),
                new LongToBooleanConverter(),
                new IntegerToLocalTimeConverter(),
                new LongToLocalTimeConverter()
        ));
    }

    @Bean
    public ApplicationRunner bookingIndexes(MongoTemplate mongoTemplate) {
        return args -> {
            try {
                var indexes = mongoTemplate.indexOps("bookings");
                indexes.ensureIndex(new Index().on("createdAt", org.springframework.data.domain.Sort.Direction.DESC)
                        .named("idx_booking_created_desc"));
                indexes.ensureIndex(new CompoundIndexDefinition(new Document()
                        .append("status", 1)
                        .append("createdAt", -1))
                        .named("idx_booking_status_created_desc"));
                indexes.ensureIndex(new CompoundIndexDefinition(new Document()
                        .append("customerId", 1)
                        .append("createdAt", -1))
                        .named("idx_booking_customer_created_desc"));
                indexes.ensureIndex(new CompoundIndexDefinition(new Document()
                        .append("stationId", 1)
                        .append("createdAt", -1))
                        .named("idx_booking_station_created_desc"));
                indexes.ensureIndex(new CompoundIndexDefinition(new Document()
                        .append("chargingPointId", 1)
                        .append("startTime", 1)
                        .append("endTime", 1))
                        .named("idx_booking_point_id_time"));
                indexes.ensureIndex(new CompoundIndexDefinition(new Document()
                        .append("chargingPoint.id", 1)
                        .append("startTime", 1)
                        .append("endTime", 1))
                        .named("idx_booking_point_time"));
            } catch (DataAccessException ex) {
                log.warn("Skipping MongoDB booking index initialization because MongoDB is unavailable: {}",
                        ex.getMessage());
            }
        };
    }

    @ReadingConverter
    static class IntegerToBooleanConverter implements Converter<Integer, Boolean> {
        @Override
        public Boolean convert(Integer source) {
            return source != null && source != 0;
        }
    }

    @ReadingConverter
    static class LongToBooleanConverter implements Converter<Long, Boolean> {
        @Override
        public Boolean convert(Long source) {
            return source != null && source != 0L;
        }
    }

    @ReadingConverter
    static class IntegerToLocalTimeConverter implements Converter<Integer, LocalTime> {
        @Override
        public LocalTime convert(Integer source) {
            return NumericLocalTimeConverter.convert(source == null ? null : source.longValue());
        }
    }

    @ReadingConverter
    static class LongToLocalTimeConverter implements Converter<Long, LocalTime> {
        @Override
        public LocalTime convert(Long source) {
            return NumericLocalTimeConverter.convert(source);
        }
    }

    static class NumericLocalTimeConverter {
        private static final long SECONDS_PER_DAY = 24L * 60L * 60L;
        private static final long MILLIS_PER_DAY = SECONDS_PER_DAY * 1_000L;
        private static final long MICROS_PER_DAY = MILLIS_PER_DAY * 1_000L;
        private static final long NANOS_PER_DAY = MICROS_PER_DAY * 1_000L;

        private NumericLocalTimeConverter() {
        }

        static LocalTime convert(Long source) {
            if (source == null) {
                return null;
            }
            long value = Math.floorMod(source, NANOS_PER_DAY);
            if (source >= 0 && source < SECONDS_PER_DAY) {
                return LocalTime.ofSecondOfDay(source);
            }
            if (source >= 0 && source < MILLIS_PER_DAY) {
                return LocalTime.ofNanoOfDay(source * 1_000_000L);
            }
            if (source >= 0 && source < MICROS_PER_DAY) {
                return LocalTime.ofNanoOfDay(source * 1_000L);
            }
            return LocalTime.ofNanoOfDay(value);
        }
    }
}
