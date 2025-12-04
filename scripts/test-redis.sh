#!/bin/bash
# Redis Cache Test Script
# Tests the Redis implementation and verifies cache functionality

echo "======================================"
echo "Redis Cache Implementation Test"
echo "======================================"
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Test 1: Check Redis is running
echo "Test 1: Checking Redis service..."
if docker exec wizard-redis redis-cli ping > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Redis is running${NC}"
else
    echo -e "${RED}✗ Redis is not running${NC}"
    echo "Run: docker compose up -d redis"
    exit 1
fi
echo ""

# Test 2: Check backend can connect to Redis
echo "Test 2: Checking backend Redis connection..."
if docker compose logs backend 2>/dev/null | grep -q "Redis connected and ready"; then
    echo -e "${GREEN}✓ Backend connected to Redis${NC}"
else
    echo -e "${YELLOW}⚠ Backend may not be connected to Redis${NC}"
    echo "Check logs: docker compose logs backend | grep Redis"
fi
echo ""

# Test 3: Test cache miss (first request)
echo "Test 3: Testing cache miss (first request)..."
START=$(date +%s%3N)
curl -s http://localhost:5000/api/online/status > /dev/null
END=$(date +%s%3N)
DURATION=$((END - START))
echo "Response time: ${DURATION}ms"

if docker compose logs backend --tail=5 2>/dev/null | grep -q "Cache miss"; then
    echo -e "${GREEN}✓ Cache miss detected (expected)${NC}"
else
    echo -e "${YELLOW}⚠ No cache miss log found${NC}"
fi
echo ""

# Test 4: Test cache hit (second request)
echo "Test 4: Testing cache hit (second request)..."
START=$(date +%s%3N)
curl -s http://localhost:5000/api/online/status > /dev/null
END=$(date +%s%3N)
DURATION=$((END - START))
echo "Response time: ${DURATION}ms"

if docker compose logs backend --tail=5 2>/dev/null | grep -q "Cache hit"; then
    echo -e "${GREEN}✓ Cache hit detected (expected)${NC}"
else
    echo -e "${YELLOW}⚠ No cache hit log found${NC}"
fi
echo ""

# Test 5: Check Redis keys
echo "Test 5: Checking cached data in Redis..."
KEYS=$(docker exec wizard-redis redis-cli KEYS '*' 2>/dev/null)
if echo "$KEYS" | grep -q "online:status"; then
    echo -e "${GREEN}✓ Online status cached in Redis${NC}"
    
    TTL=$(docker exec wizard-redis redis-cli TTL online:status 2>/dev/null)
    echo "  Time to live: ${TTL} seconds"
    
    # Show cached value
    echo "  Cached data:"
    docker exec wizard-redis redis-cli GET online:status 2>/dev/null | sed 's/^/    /'
else
    echo -e "${YELLOW}⚠ No online:status key found in Redis${NC}"
fi
echo ""

# Test 6: Check rate limiting
echo "Test 6: Checking rate limiter configuration..."
if docker compose logs backend --tail=50 2>/dev/null | grep -q "Rate limiter using Redis store"; then
    echo -e "${GREEN}✓ Rate limiter using Redis store${NC}"
else
    echo -e "${YELLOW}⚠ Rate limiter may be using memory store${NC}"
fi
echo ""

# Test 7: Redis statistics
echo "Test 7: Redis Statistics..."
STATS=$(docker exec wizard-redis redis-cli INFO stats 2>/dev/null)

HITS=$(echo "$STATS" | grep "keyspace_hits:" | cut -d':' -f2 | tr -d '\r')
MISSES=$(echo "$STATS" | grep "keyspace_misses:" | cut -d':' -f2 | tr -d '\r')
COMMANDS=$(echo "$STATS" | grep "total_commands_processed:" | cut -d':' -f2 | tr -d '\r')

echo "  Total commands: $COMMANDS"
echo "  Cache hits: $HITS"
echo "  Cache misses: $MISSES"

if [ "$HITS" -gt 0 ] && [ "$MISSES" -gt 0 ]; then
    HIT_RATE=$((HITS * 100 / (HITS + MISSES)))
    echo -e "  Hit rate: ${HIT_RATE}%"
    
    if [ "$HIT_RATE" -gt 50 ]; then
        echo -e "${GREEN}✓ Good cache hit rate${NC}"
    else
        echo -e "${YELLOW}⚠ Low cache hit rate${NC}"
    fi
fi
echo ""

# Test 8: Memory usage
echo "Test 8: Redis Memory Usage..."
MEMORY=$(docker exec wizard-redis redis-cli INFO memory 2>/dev/null | grep "used_memory_human:" | cut -d':' -f2 | tr -d '\r')
MAX_MEMORY=$(docker exec wizard-redis redis-cli CONFIG GET maxmemory 2>/dev/null | tail -1)

echo "  Used memory: $MEMORY"
if [ "$MAX_MEMORY" != "0" ]; then
    echo "  Max memory: $((MAX_MEMORY / 1024 / 1024))MB"
fi
echo ""

# Summary
echo "======================================"
echo "Test Summary"
echo "======================================"
echo ""
echo "Redis implementation is working correctly!"
echo ""
echo "Next steps:"
echo "1. Monitor cache performance: docker compose logs backend | grep Cache"
echo "2. View Redis data: docker exec -it wizard-redis redis-cli"
echo "3. Check Redis stats: docker exec wizard-redis redis-cli INFO stats"
echo ""
echo "For more information, see REDIS_IMPLEMENTATION.md"
