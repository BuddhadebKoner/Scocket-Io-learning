#!/bin/bash

echo "🔍 Redis Docker Monitoring Dashboard"
echo "====================================="

# Get Redis container information
echo "📦 Docker Container Info:"
docker ps --filter "name=redis" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

echo ""
echo "💾 Redis Memory Usage:"
docker stats --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.MemPerc}}" | grep redis

echo ""
echo "🔑 Redis Keys Info:"
docker exec -it $(docker ps -q --filter "name=redis") redis-cli INFO keyspace

echo ""
echo "📊 Redis Stats:"
docker exec -it $(docker ps -q --filter "name=redis") redis-cli INFO stats | grep -E "(keyspace_hits|keyspace_misses|total_commands_processed|instantaneous_ops_per_sec)"

echo ""
echo "🏆 Quiz Leaderboard (Top 5):"
docker exec -it $(docker ps -q --filter "name=redis") redis-cli ZREVRANGE quiz:leaderboard 0 4 WITHSCORES

echo ""
echo "📚 Cached Questions:"
docker exec -it $(docker ps -q --filter "name=redis") redis-cli EXISTS quiz:questions

echo ""
echo "📈 Quiz Statistics:"
echo "Total Attempts: $(docker exec -it $(docker ps -q --filter "name=redis") redis-cli GET quiz:stats:total_attempts)"
echo "Passed: $(docker exec -it $(docker ps -q --filter "name=redis") redis-cli GET quiz:stats:passed)"
echo "Average Score: $(docker exec -it $(docker ps -q --filter "name=redis") redis-cli GET quiz:stats:average_score)"
echo "Active Students: $(docker exec -it $(docker ps -q --filter "name=redis") redis-cli GET quiz:stats:active_students)"

echo ""
echo "🔍 Active Sessions:"
docker exec -it $(docker ps -q --filter "name=redis") redis-cli KEYS "session:*" | wc -l | xargs echo "Session Count:"

echo ""
echo "🔧 Redis Configuration:"
docker exec -it $(docker ps -q --filter "name=redis") redis-cli CONFIG GET "*max*" | head -10

echo ""
echo "====================================="
echo "Use 'docker exec -it <redis-container> redis-cli' for interactive Redis CLI"
