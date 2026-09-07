package com.plugin.config;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.net.InetAddress;
import java.net.UnknownHostException;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

@Component
public class TrustedClientIpResolver {

    private static final int MAX_FORWARDED_HEADER_LENGTH = 1_024;
    private static final int MAX_FORWARDED_HOPS = 20;

    private final List<IpRange> trustedProxies;

    public TrustedClientIpResolver(@Value("${app.rate-limit.trusted-proxies:}") String configuredRanges) {
        this.trustedProxies = parseRanges(configuredRanges);
    }

    /**
     * Uses the socket peer by default. X-Forwarded-For is considered only when
     * that immediate peer is explicitly configured as trusted. The chain is
     * then walked from the closest proxy toward the original client.
     */
    public String resolve(HttpServletRequest request) {
        InetAddress remote = parseLiteral(request.getRemoteAddr());
        if (remote == null) {
            return "unknown";
        }
        if (!isTrusted(remote)) {
            return canonical(remote);
        }

        String forwardedFor = request.getHeader("X-Forwarded-For");
        if (forwardedFor == null || forwardedFor.isBlank()
                || forwardedFor.length() > MAX_FORWARDED_HEADER_LENGTH) {
            return canonical(remote);
        }

        String[] rawHops = forwardedFor.split(",", -1);
        if (rawHops.length == 0 || rawHops.length > MAX_FORWARDED_HOPS) {
            return canonical(remote);
        }

        List<InetAddress> hops = new ArrayList<>(rawHops.length);
        for (String rawHop : rawHops) {
            InetAddress hop = parseLiteral(rawHop.trim());
            if (hop == null) {
                return canonical(remote);
            }
            hops.add(hop);
        }

        for (int index = hops.size() - 1; index >= 0; index--) {
            InetAddress hop = hops.get(index);
            if (!isTrusted(hop)) {
                return canonical(hop);
            }
        }
        return canonical(hops.get(0));
    }

    private boolean isTrusted(InetAddress address) {
        return trustedProxies.stream().anyMatch(range -> range.contains(address));
    }

    private static List<IpRange> parseRanges(String configuredRanges) {
        if (configuredRanges == null || configuredRanges.isBlank()) {
            return List.of();
        }
        return Arrays.stream(configuredRanges.split(","))
                .map(String::trim)
                .filter(value -> !value.isBlank())
                .map(IpRange::parse)
                .toList();
    }

    private static InetAddress parseLiteral(String value) {
        if (value == null || value.isBlank() || value.length() > 64
                || value.contains("%") || value.contains("[") || value.contains("]")) {
            return null;
        }
        boolean ipv4Shape = value.matches("[0-9]{1,3}(?:\\.[0-9]{1,3}){3}");
        boolean ipv6Shape = value.contains(":") && value.matches("[0-9A-Fa-f:]+" );
        if (!ipv4Shape && !ipv6Shape) {
            return null;
        }
        try {
            return InetAddress.getByName(value);
        } catch (UnknownHostException ex) {
            return null;
        }
    }

    private static String canonical(InetAddress address) {
        return address.getHostAddress();
    }

    private record IpRange(byte[] network, int prefixLength) {

        static IpRange parse(String configured) {
            String[] parts = configured.split("/", -1);
            if (parts.length > 2) {
                throw new IllegalStateException("A trusted-proxy range is invalid");
            }
            InetAddress address = parseLiteral(parts[0].trim());
            if (address == null) {
                throw new IllegalStateException("A trusted-proxy address is invalid");
            }

            byte[] bytes = address.getAddress();
            int maxPrefix = bytes.length * 8;
            int prefix = maxPrefix;
            if (parts.length == 2) {
                try {
                    prefix = Integer.parseInt(parts[1]);
                } catch (NumberFormatException ex) {
                    throw new IllegalStateException("A trusted-proxy prefix is invalid");
                }
            }
            if (prefix < 0 || prefix > maxPrefix) {
                throw new IllegalStateException("A trusted-proxy prefix is invalid");
            }

            byte[] network = bytes.clone();
            applyMask(network, prefix);
            return new IpRange(network, prefix);
        }

        boolean contains(InetAddress candidate) {
            byte[] candidateBytes = candidate.getAddress().clone();
            if (candidateBytes.length != network.length) {
                return false;
            }
            applyMask(candidateBytes, prefixLength);
            return MessageDigestSupport.equals(network, candidateBytes);
        }

        private static void applyMask(byte[] value, int prefix) {
            int completeBytes = prefix / 8;
            int remainingBits = prefix % 8;
            if (remainingBits != 0 && completeBytes < value.length) {
                int mask = 0xff << (8 - remainingBits);
                value[completeBytes] = (byte) (value[completeBytes] & mask);
                completeBytes++;
            }
            Arrays.fill(value, completeBytes, value.length, (byte) 0);
        }
    }

    private static final class MessageDigestSupport {
        private MessageDigestSupport() {
        }

        static boolean equals(byte[] left, byte[] right) {
            return java.security.MessageDigest.isEqual(left, right);
        }
    }
}
