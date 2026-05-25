package com.plugin.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.convert.converter.Converter;
import org.springframework.data.convert.ReadingConverter;
import org.springframework.data.mongodb.MongoDatabaseFactory;
import org.springframework.data.mongodb.MongoTransactionManager;
import org.springframework.data.mongodb.core.convert.MongoCustomConversions;

import java.time.LocalTime;
import java.util.List;

@Configuration
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
