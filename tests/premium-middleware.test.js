const test = require("node:test");
const assert = require("node:assert/strict");

// Mock premiumService
const mockPremiumService = {
  checkGuildPremium: async (guildId) => {
    if (guildId === 'guild-premium') {
      return {
        has_premium: true,
        tier: 'pro_monthly',
        expires_at: '2026-12-31T23:59:59Z',
        lifetime: false,
      };
    }
    if (guildId === 'guild-lifetime') {
      return {
        has_premium: true,
        tier: 'lifetime',
        expires_at: null,
        lifetime: true,
      };
    }
    return {
      has_premium: false,
      tier: null,
      expires_at: null,
      lifetime: false,
    };
  },
  checkFeatureAccess: async (guildId, feature) => {
    if (guildId === 'guild-premium' || guildId === 'guild-lifetime') {
      return true;
    }
    return false;
  },
  getTierFeatures: (tier) => {
    if (tier === 'lifetime') {
      return {
        name: 'Lifetime',
        max_custom_commands: 100,
        advanced_moderation: true,
      };
    }
    if (tier === 'pro_monthly' || tier === 'pro_yearly') {
      return {
        name: 'Pro',
        max_custom_commands: 50,
        advanced_moderation: true,
      };
    }
    return {
      name: 'Free',
      max_custom_commands: 5,
      advanced_moderation: false,
    };
  },
  getDefaultPremiumStatus: () => ({
    has_premium: false, tier: null, expires_at: null, lifetime: false, owner_user_id: null,
  }),
};

// Mock discord.js EmbedBuilder
class MockEmbedBuilder {
  constructor() {
    this.data = {};
  }
  setColor(color) {
    this.data.color = color;
    return this;
  }
  setTitle(title) {
    this.data.title = title;
    return this;
  }
  setDescription(desc) {
    this.data.description = desc;
    return this;
  }
  addFields(...fields) {
    this.data.fields = fields;
    return this;
  }
  setFooter(footer) {
    this.data.footer = footer;
    return this;
  }
}

// Mock modules
const Module = require('module');
const originalLoad = Module._load;

Module._load = function (request, parent) {
  if (request === '../services/premiumService') {
    return { premiumService: mockPremiumService };
  }
  if (request === 'discord.js') {
    return { EmbedBuilder: MockEmbedBuilder };
  }
  return originalLoad(request, parent);
};

// Clear cache and reload module
delete require.cache[require.resolve('../src/utils/premiumMiddleware')];
const {
  requirePremium,
  requireFeature,
  createPremiumEmbed,
  checkLimit,
  safeReply,
} = require('../src/utils/premiumMiddleware');

test.after(() => {
  Module._load = originalLoad;
  delete require.cache[require.resolve('../src/utils/premiumMiddleware')];
});

function makeInteraction({ guildId = 'guild-123', replied = false, deferred = false } = {}) {
  const responses = [];
  
  return {
    guildId,
    replied,
    deferred,
    reply: async (payload) => {
      responses.push({ type: 'reply', payload });
      return payload;
    },
    editReply: async (payload) => {
      responses.push({ type: 'editReply', payload });
      return payload;
    },
    followUp: async (payload) => {
      responses.push({ type: 'followUp', payload });
      return payload;
    },
    _getResponses: () => responses,
  };
}

test("requirePremium responde con reply cuando interacción no fue respondida", async () => {
  const interaction = makeInteraction({ guildId: 'guild-free', replied: false, deferred: false });
  
  const result = await requirePremium(interaction);
  
  assert.equal(result, false);
  const responses = interaction._getResponses();
  assert.equal(responses.length, 1);
  assert.equal(responses[0].type, 'reply');
  assert.equal(responses[0].payload.ephemeral, true);
  assert.equal(Array.isArray(responses[0].payload.embeds), true);
});

test("requirePremium responde con editReply cuando interacción fue deferida", async () => {
  const interaction = makeInteraction({ guildId: 'guild-free', replied: false, deferred: true });
  
  const result = await requirePremium(interaction);
  
  assert.equal(result, false);
  const responses = interaction._getResponses();
  assert.equal(responses.length, 1);
  assert.equal(responses[0].type, 'editReply');
  assert.equal(responses[0].payload.ephemeral, true);
});

test("requirePremium responde con editReply cuando interacción ya fue respondida", async () => {
  const interaction = makeInteraction({ guildId: 'guild-free', replied: true, deferred: false });
  
  const result = await requirePremium(interaction);
  
  assert.equal(result, false);
  const responses = interaction._getResponses();
  assert.equal(responses.length, 1);
  assert.equal(responses[0].type, 'editReply');
});

test("requirePremium devuelve true para guild con premium", async () => {
  const interaction = makeInteraction({ guildId: 'guild-premium', replied: false, deferred: false });
  
  const result = await requirePremium(interaction);
  
  assert.equal(result, true);
  const responses = interaction._getResponses();
  assert.equal(responses.length, 0);
});

test("requirePremium rechaza si no hay guildId", async () => {
  const interaction = makeInteraction({ guildId: null, replied: false, deferred: false });
  
  const result = await requirePremium(interaction);
  
  assert.equal(result, false);
  const responses = interaction._getResponses();
  assert.equal(responses.length, 1);
  assert.equal(responses[0].payload.content.includes('server'), true);
});

test("requirePremium valida requiredTier correctamente", async () => {
  const interactionMonthly = makeInteraction({ guildId: 'guild-premium', replied: false });
  
  const resultAllowed = await requirePremium(interactionMonthly, { requiredTier: 'pro_monthly' });
  assert.equal(resultAllowed, true);
  
  const interactionLifetime = makeInteraction({ guildId: 'guild-premium', replied: false });
  const resultDenied = await requirePremium(interactionLifetime, { requiredTier: 'lifetime' });
  
  assert.equal(resultDenied, false);
  const responses = interactionLifetime._getResponses();
  assert.equal(responses.length, 1);
  assert.equal(responses[0].payload.embeds[0].data.title.includes('Higher Tier'), true);
});

test("requireFeature responde con reply cuando interacción no fue respondida", async () => {
  const interaction = makeInteraction({ guildId: 'guild-free', replied: false, deferred: false });
  
  const result = await requireFeature(interaction, 'advanced_moderation');
  
  assert.equal(result, false);
  const responses = interaction._getResponses();
  assert.equal(responses.length, 1);
  assert.equal(responses[0].type, 'reply');
  assert.equal(responses[0].payload.ephemeral, true);
});

test("requireFeature responde con editReply cuando interacción fue deferida", async () => {
  const interaction = makeInteraction({ guildId: 'guild-free', replied: false, deferred: true });
  
  const result = await requireFeature(interaction, 'advanced_moderation');
  
  assert.equal(result, false);
  const responses = interaction._getResponses();
  assert.equal(responses.length, 1);
  assert.equal(responses[0].type, 'editReply');
});

test("requireFeature responde con editReply cuando interacción ya fue respondida", async () => {
  const interaction = makeInteraction({ guildId: 'guild-free', replied: true, deferred: false });
  
  const result = await requireFeature(interaction, 'advanced_moderation');
  
  assert.equal(result, false);
  const responses = interaction._getResponses();
  assert.equal(responses.length, 1);
  assert.equal(responses[0].type, 'editReply');
});

test("requireFeature devuelve true para guild con acceso a feature", async () => {
  const interaction = makeInteraction({ guildId: 'guild-premium', replied: false, deferred: false });
  
  const result = await requireFeature(interaction, 'advanced_moderation');
  
  assert.equal(result, true);
  const responses = interaction._getResponses();
  assert.equal(responses.length, 0);
});

test("requireFeature rechaza si no hay guildId", async () => {
  const interaction = makeInteraction({ guildId: null, replied: false, deferred: false });
  
  const result = await requireFeature(interaction, 'advanced_moderation');
  
  assert.equal(result, false);
  const responses = interaction._getResponses();
  assert.equal(responses.length, 1);
  assert.equal(responses[0].payload.content.includes('server'), true);
});

test("PRO_UPGRADE_URL usa variable de entorno con fallback", async () => {
  const originalEnv = process.env.PRO_UPGRADE_URL;
  
  // Test con env var configurada
  process.env.PRO_UPGRADE_URL = 'https://custom-pricing.example.com';
  
  delete require.cache[require.resolve('../src/utils/premiumMiddleware')];
  const middleware1 = require('../src/utils/premiumMiddleware');
  
  const interaction1 = makeInteraction({ guildId: 'guild-free', replied: false });
  await middleware1.requirePremium(interaction1);
  
  const responses1 = interaction1._getResponses();
  const embedFields1 = responses1[0].payload.embeds[0].data.fields;
  const upgradeField1 = embedFields1.find(f => f.name.includes('Get Premium'));
  
  assert.equal(upgradeField1.value.includes('custom-pricing.example.com'), true);
  
  // Test con fallback
  delete process.env.PRO_UPGRADE_URL;
  
  delete require.cache[require.resolve('../src/utils/premiumMiddleware')];
  const middleware2 = require('../src/utils/premiumMiddleware');
  
  const interaction2 = makeInteraction({ guildId: 'guild-free', replied: false });
  await middleware2.requirePremium(interaction2);
  
  const responses2 = interaction2._getResponses();
  const embedFields2 = responses2[0].payload.embeds[0].data.fields;
  const upgradeField2 = embedFields2.find(f => f.name.includes('Get Premium'));
  
  assert.equal(upgradeField2.value.includes('store.ton618bot.xyz'), true);
  
  // Restore
  if (originalEnv) {
    process.env.PRO_UPGRADE_URL = originalEnv;
  }
  
  delete require.cache[require.resolve('../src/utils/premiumMiddleware')];
});

test("createPremiumEmbed genera embed correcto para guild premium", async () => {
  const premium = {
    has_premium: true,
    tier: 'pro_monthly',
    expires_at: '2026-12-31T23:59:59Z',
    lifetime: false,
  };
  
  const embed = createPremiumEmbed('guild-premium', premium);
  
  assert.equal(embed.data.color, '#4CAF50');
  assert.equal(embed.data.title.includes('Premium Active'), true);
  assert.equal(embed.data.description.includes('Pro'), true);
});

test("createPremiumEmbed genera embed correcto para guild free", async () => {
  const premium = {
    has_premium: false,
    tier: null,
    expires_at: null,
    lifetime: false,
  };
  
  const embed = createPremiumEmbed('guild-free', premium);
  
  assert.equal(embed.data.color, '#9E9E9E');
  assert.equal(embed.data.title.includes('Free Plan'), true);
  assert.equal(embed.data.description.includes('Free Plan'), true);
});

test("createPremiumEmbed muestra lifetime access correctamente", async () => {
  const premium = {
    has_premium: true,
    tier: 'lifetime',
    expires_at: null,
    lifetime: true,
  };
  
  const embed = createPremiumEmbed('guild-lifetime', premium);
  
  assert.equal(embed.data.description.includes('Lifetime Access'), true);
});

test("checkLimit valida límites según tier", async () => {
  const resultFree = await checkLimit('guild-free', 'custom_commands', 3);
  assert.equal(resultFree.allowed, true);
  assert.equal(resultFree.limit, 5);
  assert.equal(resultFree.remaining, 2);
  
  const resultFreeExceeded = await checkLimit('guild-free', 'custom_commands', 5);
  assert.equal(resultFreeExceeded.allowed, false);
  assert.equal(resultFreeExceeded.limit, 5);
  
  const resultPremium = await checkLimit('guild-premium', 'custom_commands', 30);
  assert.equal(resultPremium.allowed, true);
  assert.equal(resultPremium.limit, 50);
  assert.equal(resultPremium.remaining, 20);
});

test("safeReply maneja errores y usa followUp como fallback", async () => {
  const failingInteraction = {
    guildId: 'guild-test',
    replied: false,
    deferred: false,
    reply: async () => {
      throw new Error('Reply failed');
    },
    editReply: async () => {
      throw new Error('EditReply failed');
    },
    followUp: async (payload) => {
      return { type: 'followUp', payload };
    },
  };
  
  // requirePremium internamente usa safeReply, que debería hacer fallback a followUp
  try {
    await requirePremium(failingInteraction);
    // Si llegamos aquí, el fallback funcionó
    assert.ok(true);
  } catch (error) {
    // Solo falla si followUp también falla
    assert.equal(error.message.includes('followUp'), true);
  }
});
