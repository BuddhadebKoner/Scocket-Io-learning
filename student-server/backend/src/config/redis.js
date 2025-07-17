import { createClient } from 'redis';
import dotenv from 'dotenv';

dotenv.config();

// Redis configuration
const redisConfig = {
   url: process.env.REDIS_URL || 'redis://localhost:6379',
   socket: {
      reconnectStrategy: (retries) => {
         if (retries > 10) {
            console.error('❌ Redis: Too many reconnection attempts. Giving up.');
            return new Error('Redis connection failed');
         }
         console.log(`🔄 Redis: Reconnecting... Attempt ${retries}`);
         return Math.min(retries * 100, 3000); // Exponential backoff, max 3 seconds
      }
   },
   // Graceful degradation - if Redis is not available, the app should still work
   lazyConnect: true
};

// Create Redis client
const redisClient = createClient(redisConfig);

// Redis connection event handlers
redisClient.on('connect', () => {
   console.log('🔗 Redis: Connecting...');
});

redisClient.on('ready', () => {
   console.log('✅ Redis: Connected and ready!');
});

redisClient.on('error', (err) => {
   console.error('❌ Redis Error:', err.message);
   console.log('🔄 Redis: Application will continue without caching');
});

redisClient.on('end', () => {
   console.log('🔌 Redis: Connection closed');
});

// Initialize Redis connection
async function connectRedis() {
   try {
      await redisClient.connect();
      console.log('🚀 Redis: Successfully connected');

      // Test Redis connection
      await redisClient.ping();
      console.log('🏓 Redis: Ping successful');

      return true;
   } catch (error) {
      console.error('❌ Redis connection failed:', error.message);
      console.log('🔄 Application will run without Redis caching');
      return false;
   }
}

// Graceful Redis operations with fallback
class RedisHelper {
   static async set(key, value, expireInSeconds = 3600) {
      try {
         if (!redisClient.isReady) {
            return false;
         }

         const stringValue = typeof value === 'string' ? value : JSON.stringify(value);
         await redisClient.setEx(key, expireInSeconds, stringValue);
         return true;
      } catch (error) {
         console.error(`❌ Redis SET error for key "${key}":`, error.message);
         return false;
      }
   }

   static async get(key) {
      try {
         if (!redisClient.isReady) {
            return null;
         }

         const value = await redisClient.get(key);
         if (!value) return null;

         // Try to parse as JSON, fallback to string
         try {
            return JSON.parse(value);
         } catch {
            return value;
         }
      } catch (error) {
         console.error(`❌ Redis GET error for key "${key}":`, error.message);
         return null;
      }
   }

   static async del(key) {
      try {
         if (!redisClient.isReady) {
            return false;
         }

         await redisClient.del(key);
         return true;
      } catch (error) {
         console.error(`❌ Redis DEL error for key "${key}":`, error.message);
         return false;
      }
   }

   static async exists(key) {
      try {
         if (!redisClient.isReady) {
            return false;
         }

         const result = await redisClient.exists(key);
         return result === 1;
      } catch (error) {
         console.error(`❌ Redis EXISTS error for key "${key}":`, error.message);
         return false;
      }
   }

   static async incr(key) {
      try {
         if (!redisClient.isReady) {
            return 1;
         }

         return await redisClient.incr(key);
      } catch (error) {
         console.error(`❌ Redis INCR error for key "${key}":`, error.message);
         return 1;
      }
   }

   static async zadd(key, score, member) {
      try {
         if (!redisClient.isReady) {
            return false;
         }

         await redisClient.zAdd(key, { score, value: member });
         return true;
      } catch (error) {
         console.error(`❌ Redis ZADD error for key "${key}":`, error.message);
         return false;
      }
   }

   static async zrevrange(key, start = 0, stop = 9) {
      try {
         if (!redisClient.isReady) {
            return [];
         }

         return await redisClient.zRangeWithScores(key, start, stop, {
            REV: true
         });
      } catch (error) {
         console.error(`❌ Redis ZREVRANGE error for key "${key}":`, error.message);
         return [];
      }
   } static async flushPattern(pattern) {
      try {
         if (!redisClient.isReady) {
            return false;
         }

         const keys = await redisClient.keys(pattern);
         if (keys.length > 0) {
            await redisClient.del(keys);
         }
         return true;
      } catch (error) {
         console.error(`❌ Redis FLUSH PATTERN error for pattern "${pattern}":`, error.message);
         return false;
      }
   }

   static isConnected() {
      return redisClient.isReady;
   }
}

// Graceful shutdown
async function closeRedis() {
   try {
      if (redisClient.isOpen) {
         await redisClient.quit();
         console.log('✅ Redis: Connection closed gracefully');
      }
   } catch (error) {
      console.error('❌ Redis: Error during shutdown:', error.message);
   }
}

export {
   redisClient,
   connectRedis,
   closeRedis,
   RedisHelper
};
