# Redis Docker Monitoring Dashboard for Windows
Write-Host "Redis Docker Monitoring Dashboard" -ForegroundColor Cyan
Write-Host "=================================" -ForegroundColor Cyan

# Get Redis container information
Write-Host "`nDocker Container Info:" -ForegroundColor Yellow
docker ps --filter "name=redis" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

Write-Host "`nRedis Memory Usage:" -ForegroundColor Yellow
docker stats --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.MemPerc}}" | findstr redis

Write-Host "`nRedis Keys Info:" -ForegroundColor Yellow
$redisContainer = docker ps -q --filter "name=redis"
if ($redisContainer) {
   Write-Host "Redis container found: $redisContainer" -ForegroundColor Green
   docker exec $redisContainer redis-cli INFO keyspace
}
else {
   Write-Host "No Redis container found" -ForegroundColor Red
}

Write-Host "`nRedis Stats:" -ForegroundColor Yellow
if ($redisContainer) {
   docker exec $redisContainer redis-cli INFO stats | Select-String -Pattern "(keyspace_hits|keyspace_misses|total_commands_processed|instantaneous_ops_per_sec)"
}

Write-Host "`nQuiz Leaderboard (Top 5):" -ForegroundColor Yellow
if ($redisContainer) {
   docker exec $redisContainer redis-cli ZREVRANGE quiz:leaderboard 0 4 WITHSCORES
}

Write-Host "`nCached Questions:" -ForegroundColor Yellow
if ($redisContainer) {
   $questionsExist = docker exec $redisContainer redis-cli EXISTS quiz:questions
   if ($questionsExist -eq 1) {
      Write-Host "Questions cached: Yes" -ForegroundColor Green
   }
   else {
      Write-Host "Questions cached: No" -ForegroundColor Red
   }
}

Write-Host "`nQuiz Statistics:" -ForegroundColor Yellow
if ($redisContainer) {
   $totalAttempts = docker exec $redisContainer redis-cli GET quiz:stats:total_attempts
   $passed = docker exec $redisContainer redis-cli GET quiz:stats:passed
   $avgScore = docker exec $redisContainer redis-cli GET quiz:stats:average_score
   $activeStudents = docker exec $redisContainer redis-cli GET quiz:stats:active_students
    
   Write-Host "Total Attempts: $totalAttempts" -ForegroundColor Green
   Write-Host "Passed: $passed" -ForegroundColor Green
   Write-Host "Average Score: $avgScore" -ForegroundColor Green
   Write-Host "Active Students: $activeStudents" -ForegroundColor Green
}

Write-Host "`nActive Sessions:" -ForegroundColor Yellow
if ($redisContainer) {
   $sessionKeys = docker exec $redisContainer redis-cli KEYS "session:*"
   if ($sessionKeys) {
      $sessionArray = $sessionKeys -split "`n"
      $count = ($sessionArray | Where-Object { $_ -ne "" }).Count
      Write-Host "Session Count: $count" -ForegroundColor Green
      if ($count -gt 0) {
         Write-Host "Active session keys:" -ForegroundColor Gray
         $sessionArray | Where-Object { $_ -ne "" } | ForEach-Object { Write-Host "  $_" -ForegroundColor Gray }
      }
   }
   else {
      Write-Host "Session Count: 0" -ForegroundColor Green
   }
}

Write-Host "`nRedis Configuration:" -ForegroundColor Yellow
if ($redisContainer) {
   docker exec $redisContainer redis-cli CONFIG GET "*max*" | Select-Object -First 10
}

Write-Host "`n=================================" -ForegroundColor Cyan
Write-Host "Commands for manual inspection:" -ForegroundColor Yellow
Write-Host "docker exec -it $redisContainer redis-cli" -ForegroundColor White
Write-Host "KEYS *                    # List all keys" -ForegroundColor Gray
Write-Host "INFO memory               # Memory information" -ForegroundColor Gray
Write-Host "INFO stats                # Performance stats" -ForegroundColor Gray
Write-Host "MONITOR                   # Real-time command monitoring" -ForegroundColor Gray
