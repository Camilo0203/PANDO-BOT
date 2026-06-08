"use strict";

/**
 * SearchCacheService
 * Caches search results to avoid repeated API calls.
 * Supports multiple search engines: YouTube, Spotify, etc.
 */

const logger = require("../../../utils/structuredLogger");

const log = {
  info: (msg, meta) => logger.info("Music.SEARCHCACHE", msg, meta || {}),
  warn: (msg, meta) => logger.warn("Music.SEARCHCACHE", msg, meta || {}),
  error: (msg, meta) => logger.error("Music.SEARCHCACHE", msg, meta || {}),
  debug: (msg, meta) => logger.debug("Music.SEARCHCACHE", msg, meta || {}),
};

class SearchCacheService {
  constructor(options = {}) {
    this.cache = new Map();
    this.sessionTracks = new Map();

    this.maxCacheSize = options.maxCacheSize || 100;
    this.cacheTTL = options.cacheTTL || 3600000;
    this.maxSessionTTL = options.maxSessionTTL || 300000;
    this.maxPaginationResults = options.maxPaginationResults || 100;
    this.maxSelectMenuOptions = options.maxSelectMenuOptions || 25;

    this.cleanupInterval = setInterval(() => this.cleanup(), 60000);
  }

  getCacheKey(query, engine = "youtube") {
    return `${engine}:${query.toLowerCase().trim()}`;
  }

  getSessionKey(userId) {
    return `session:${userId}`;
  }

  setCache(query, results, engine = "youtube") {
    const key = this.getCacheKey(query, engine);

    const cacheEntry = {
      results,
      timestamp: Date.now(),
      hits: 0,
    };

    this.cache.set(key, cacheEntry);

    if (this.cache.size > this.maxCacheSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }

    log.debug("Cache set", { query, engine, trackCount: results.tracks?.length || 0 });
    return cacheEntry;
  }

  getCache(query, engine = "youtube") {
    const key = this.getCacheKey(query, engine);
    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    if (Date.now() - entry.timestamp > this.cacheTTL) {
      this.cache.delete(key);
      return null;
    }

    entry.hits++;
    this.cache.delete(key);
    this.cache.set(key, entry);

    log.debug("Cache hit", { query, engine, hits: entry.hits });
    return entry.results;
  }

  setSessionTracks(userId, tracks) {
    const key = this.getSessionKey(userId);

    const sessionEntry = {
      tracks,
      timestamp: Date.now(),
      currentPage: 0,
    };

    this.sessionTracks.set(key, sessionEntry);
    log.debug("Session tracks set", { userId, trackCount: tracks.length });
    return sessionEntry;
  }

  getSessionTracks(userId) {
    const key = this.getSessionKey(userId);
    const entry = this.sessionTracks.get(key);

    if (!entry) {
      return null;
    }

    if (Date.now() - entry.timestamp > this.maxSessionTTL) {
      this.sessionTracks.delete(key);
      return null;
    }

    return entry.tracks;
  }

  getPaginatedResults(userId, pageNum = 0) {
    const tracks = this.getSessionTracks(userId);

    if (!tracks) {
      return null;
    }

    const itemsPerPage = this.maxSelectMenuOptions;
    const totalPages = Math.ceil(tracks.length / itemsPerPage);

    if (pageNum < 0 || pageNum >= totalPages) {
      return null;
    }

    const startIdx = pageNum * itemsPerPage;
    const endIdx = Math.min(startIdx + itemsPerPage, tracks.length);
    const pageResults = tracks.slice(startIdx, endIdx);

    return {
      tracks: pageResults,
      pageNum,
      totalPages,
      totalTracks: tracks.length,
      hasNext: pageNum < totalPages - 1,
      hasPrev: pageNum > 0,
      startIdx: startIdx + 1,
      endIdx,
    };
  }

  setCurrentPage(userId, pageNum) {
    const key = this.getSessionKey(userId);
    const entry = this.sessionTracks.get(key);

    if (entry) {
      entry.currentPage = pageNum;
    }
  }

  getCurrentPage(userId) {
    const key = this.getSessionKey(userId);
    const entry = this.sessionTracks.get(key);
    return entry ? entry.currentPage : 0;
  }

  getTrackByIndex(userId, index) {
    const tracks = this.getSessionTracks(userId);

    if (!tracks || index < 0 || index >= tracks.length) {
      return null;
    }

    return tracks[index];
  }

  clearSession(userId) {
    const key = this.getSessionKey(userId);
    this.sessionTracks.delete(key);
    log.debug("Session cleared", { userId });
  }

  cleanup() {
    const now = Date.now();
    let cacheCleanups = 0;
    let sessionCleanups = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > this.cacheTTL) {
        this.cache.delete(key);
        cacheCleanups++;
      }
    }

    for (const [key, entry] of this.sessionTracks.entries()) {
      if (now - entry.timestamp > this.maxSessionTTL) {
        this.sessionTracks.delete(key);
        sessionCleanups++;
      }
    }

    if (cacheCleanups > 0 || sessionCleanups > 0) {
      log.debug("Cache cleanup completed", { cacheCleanups, sessionCleanups });
    }
  }

  getStats() {
    return {
      cacheSize: this.cache.size,
      activeSessions: this.sessionTracks.size,
      cacheHits: Array.from(this.cache.values()).reduce((sum, e) => sum + e.hits, 0),
    };
  }

  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.cache.clear();
    this.sessionTracks.clear();
    log.info("SearchCacheService destroyed");
  }
}

module.exports = { SearchCacheService };
