const test = require("node:test");
const assert = require("node:assert/strict");

const {
  get,
  set,
  invalidate,
  invalidateGuild,
  clearAll,
  cleanup,
  getStats,
  getMember,
  getChannel,
  getRole,
  DEFAULT_TTL,
  MAX_SIZE,
} = require("../src/utils/apiCache");

test.beforeEach(() => {
  clearAll();
});

test.afterEach(() => {
  clearAll();
});

test("apiCache guarda y recupera datos", () => {
  const payload = { id: "123", name: "Test" };
  set("members", "guild-1", "user-1", payload);

  assert.deepEqual(get("members", "guild-1", "user-1"), payload);
  assert.equal(getStats().hits > 0, true);
});

test("apiCache invalida entradas individuales y por guild", () => {
  set("members", "guild-1", "user-1", { id: "1" });
  set("channels", "guild-1", "channel-1", { id: "c1" });
  set("members", "guild-2", "user-2", { id: "2" });

  assert.equal(invalidate("members", "guild-1", "user-1"), true);
  assert.equal(get("members", "guild-1", "user-1"), null);

  const removed = invalidateGuild("guild-1");
  assert.equal(removed >= 1, true);
  assert.equal(get("channels", "guild-1", "channel-1"), null);
  assert.deepEqual(get("members", "guild-2", "user-2"), { id: "2" });
});

test("apiCache limpia entradas expiradas", async () => {
  set("members", "guild-1", "expired", { id: "1" }, 1);
  set("members", "guild-1", "fresh", { id: "2" }, 10_000);

  await new Promise((resolve) => setTimeout(resolve, 10));

  const cleaned = cleanup();
  assert.equal(cleaned >= 1, true);
  assert.equal(get("members", "guild-1", "expired"), null);
  assert.deepEqual(get("members", "guild-1", "fresh"), { id: "2" });
});

test("apiCache expone estadisticas y constantes coherentes", () => {
  set("members", "guild-1", "user-1", { id: "1" });
  get("members", "guild-1", "missing");
  get("members", "guild-1", "user-1");

  const stats = getStats();
  assert.equal(typeof stats.totalSize, "number");
  assert.equal(typeof stats.hitRate, "number");
  assert.equal(DEFAULT_TTL.members, 5 * 60 * 1000);
  assert.equal(MAX_SIZE.channels, 500);
});

test("apiCache wrappers usan cache y toleran fallos de Discord", async () => {
  let memberFetches = 0;
  let channelFetches = 0;
  let roleFetches = 0;

  const guild = {
    id: "guild-1",
    members: {
      fetch: async (userId) => {
        memberFetches += 1;
        return { id: userId };
      },
    },
    channels: {
      fetch: async (channelId) => {
        channelFetches += 1;
        return { id: channelId };
      },
    },
    roles: {
      fetch: async (roleId) => {
        roleFetches += 1;
        return { id: roleId };
      },
    },
  };

  const memberOne = await getMember(guild, "user-1");
  const memberTwo = await getMember(guild, "user-1");
  const channelOne = await getChannel(guild, "channel-1");
  const channelTwo = await getChannel(guild, "channel-1");
  const roleOne = await getRole(guild, "role-1");
  const roleTwo = await getRole(guild, "role-1");

  assert.deepEqual(memberOne, memberTwo);
  assert.deepEqual(channelOne, channelTwo);
  assert.deepEqual(roleOne, roleTwo);
  assert.equal(memberFetches, 1);
  assert.equal(channelFetches, 1);
  assert.equal(roleFetches, 1);

  const failingGuild = {
    id: "guild-2",
    members: { fetch: async () => { throw new Error("boom"); } },
    channels: { fetch: async () => { throw new Error("boom"); } },
    roles: { fetch: async () => { throw new Error("boom"); } },
  };

  assert.equal(await getMember(failingGuild, "user-2"), null);
  assert.equal(await getChannel(failingGuild, "channel-2"), null);
  assert.equal(await getRole(failingGuild, "role-2"), null);
});
