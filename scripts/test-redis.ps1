# Redis Cache Test Script (PowerShell)
# Tests the Redis implementation and verifies cache functionality

Write-Host "======================================" -ForegroundColor Cyan
Write-Host "Redis Cache Implementation Test" -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan
Write-Host ""

# Test 1: Check Redis is running
Write-Host "Test 1: Checking Redis service..." -ForegroundColor Yellow
$redisTest = docker exec wizard-redis redis-cli ping 2>&1
if ($redisTest -match "PONG") {
    Write-Host "[PASS] Redis is running" -ForegroundColor Green
} else {
    Write-Host "[FAIL] Redis is not running" -ForegroundColor Red
    exit 1
}
Write-Host ""

# Test 2: Check backend can connect to Redis
Write-Host "Test 2: Checking backend Redis connection..." -ForegroundColor Yellow
$backendLogs = docker compose logs backend 2>$null | Select-String "Redis connected and ready"
if ($backendLogs) {
    Write-Host "[PASS] Backend connected to Redis" -ForegroundColor Green
} else {
    Write-Host "[FAIL] Backend not connected to Redis" -ForegroundColor Red
}
Write-Host ""

# Test 3: Test cache
Write-Host "Test 3: Testing cache functionality..." -ForegroundColor Yellow
Invoke-WebRequest -Uri "http://localhost:5000/api/online/status" -UseBasicParsing | Out-Null
Start-Sleep -Milliseconds 500
Invoke-WebRequest -Uri "http://localhost:5000/api/online/status" -UseBasicParsing | Out-Null

$cacheHit = docker compose logs backend --tail=10 2>$null | Select-String "Cache hit"
if ($cacheHit) {
    Write-Host "[PASS] Cache is working (hit detected)" -ForegroundColor Green
} else {
    Write-Host "[WARN] No cache hit detected" -ForegroundColor Yellow
}
Write-Host ""

# Test 4: Check Redis keys
Write-Host "Test 4: Checking cached data in Redis..." -ForegroundColor Yellow
$keys = docker exec wizard-redis redis-cli KEYS '*' 2>$null
if ($keys -match "online:status") {
    Write-Host "[PASS] Online status cached in Redis" -ForegroundColor Green
    $ttl = docker exec wizard-redis redis-cli TTL online:status 2>$null
    Write-Host "  TTL: $ttl seconds" -ForegroundColor Gray
} else {
    Write-Host "[WARN] No online:status key found" -ForegroundColor Yellow
}
Write-Host ""

# Test 5: Check rate limiting
Write-Host "Test 5: Checking rate limiter..." -ForegroundColor Yellow
$rateLimiter = docker compose logs backend 2>$null | Select-String "Rate limiter using Redis store"
if ($rateLimiter) {
    Write-Host "[PASS] Rate limiter using Redis store" -ForegroundColor Green
} else {
    Write-Host "[WARN] Rate limiter may be using memory store" -ForegroundColor Yellow
}

$rlKeys = docker exec wizard-redis redis-cli KEYS 'rl:*' 2>$null
if ($rlKeys) {
    Write-Host "  Rate limiter keys found: $rlKeys" -ForegroundColor Gray
}
Write-Host ""

# Test 6: Redis statistics
Write-Host "Test 6: Redis Statistics..." -ForegroundColor Yellow
$stats = docker exec wizard-redis redis-cli INFO stats 2>$null | Out-String

$hitsLine = $stats | Select-String "keyspace_hits:"
$missesLine = $stats | Select-String "keyspace_misses:"

if ($hitsLine -and $missesLine) {
    $hits = $hitsLine.Line -replace ".*:", "" -replace "\r", "" -replace "\n", ""
    $misses = $missesLine.Line -replace ".*:", "" -replace "\r", "" -replace "\n", ""
    Write-Host "  Cache hits: $hits" -ForegroundColor Gray
    Write-Host "  Cache misses: $misses" -ForegroundColor Gray
    
    if (($hits -as [int]) -and ($misses -as [int]) -and ([int]$hits -gt 0)) {
        $hitRate = [math]::Round(([int]$hits * 100 / ([int]$hits + [int]$misses)), 1)
        Write-Host "  Hit rate: $hitRate%" -ForegroundColor Gray
    }
}
Write-Host ""

# Summary
Write-Host "======================================" -ForegroundColor Cyan
Write-Host "Summary" -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Redis implementation is active!" -ForegroundColor Green
Write-Host ""
Write-Host "Useful commands:" -ForegroundColor Yellow
Write-Host "  Monitor cache: docker compose logs backend | Select-String Cache" -ForegroundColor Gray
Write-Host "  Redis CLI: docker exec -it wizard-redis redis-cli" -ForegroundColor Gray
Write-Host "  View keys: docker exec wizard-redis redis-cli KEYS '*'" -ForegroundColor Gray
Write-Host "  Stats: docker exec wizard-redis redis-cli INFO stats" -ForegroundColor Gray
Write-Host ""
Write-Host "Documentation: REDIS_IMPLEMENTATION.md" -ForegroundColor Cyan
