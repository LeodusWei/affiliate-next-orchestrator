import { query, mutation, action } from "./_generated/server";
import { v } from "convex/values";
import { authComponent } from "./auth";

// Get user's API keys
export const getUserApiKeys = query({
	args: {},
	returns: v.optional(v.object({
		_id: v.id("apiKeys"),
		hasHetznerKey: v.boolean(),
		hasDokployKey: v.boolean(),
		dokployUrl: v.optional(v.string()),
		isHetznerValid: v.boolean(),
		isDokployValid: v.boolean(),
		lastValidated: v.optional(v.number()),
	})),
	handler: async (ctx) => {
		const user = await authComponent.getAuthUser(ctx);
		if (!user) {
			throw new Error("Not authenticated");
		}

		const apiKeys = await ctx.db
			.query("apiKeys")
			.withIndex("by_user", (q) => q.eq("userId", user.id))
			.unique();

		if (!apiKeys) {
			return null;
		}

		return {
			_id: apiKeys._id,
			hasHetznerKey: !!apiKeys.hetznerApiKey,
			hasDokployKey: !!apiKeys.dokployApiKey,
			dokployUrl: apiKeys.dokployUrl,
			isHetznerValid: apiKeys.isHetznerValid,
			isDokployValid: apiKeys.isDokployValid,
			lastValidated: apiKeys.lastValidated,
		};
	},
});

// Store encrypted API keys
export const storeApiKeys = mutation({
	args: {
		hetznerApiKey: v.optional(v.string()),
		dokployApiKey: v.optional(v.string()),
		dokployUrl: v.optional(v.string()),
	},
	returns: v.id("apiKeys"),
	handler: async (ctx, args) => {
		const user = await authComponent.getAuthUser(ctx);
		if (!user) {
			throw new Error("Not authenticated");
		}

		// For MVP, we'll store keys as-is. In production, implement encryption here
		// TODO: Implement proper encryption for sensitive data
		const encryptedHetznerKey = args.hetznerApiKey;
		const encryptedDokployKey = args.dokployApiKey;

		const existingKeys = await ctx.db
			.query("apiKeys")
			.withIndex("by_user", (q) => q.eq("userId", user.id))
			.unique();

		if (existingKeys) {
			// Update existing keys
			await ctx.db.patch(existingKeys._id, {
				hetznerApiKey: encryptedHetznerKey || existingKeys.hetznerApiKey,
				dokployApiKey: encryptedDokployKey || existingKeys.dokployApiKey,
				dokployUrl: args.dokployUrl || existingKeys.dokployUrl,
				isHetznerValid: false, // Reset validation status when keys change
				isDokployValid: false,
				lastValidated: undefined,
			});
			return existingKeys._id;
		} else {
			// Create new keys record
			return await ctx.db.insert("apiKeys", {
				userId: user.id,
				hetznerApiKey: encryptedHetznerKey,
				dokployApiKey: encryptedDokployKey,
				dokployUrl: args.dokployUrl,
				isHetznerValid: false,
				isDokployValid: false,
			});
		}
	},
});

// Validate API keys (placeholder implementation)
export const validateApiKeys = action({
	args: {
		hetznerApiKey: v.optional(v.string()),
		dokployApiKey: v.optional(v.string()),
		dokployUrl: v.optional(v.string()),
	},
	returns: v.object({
		hetznerValid: v.boolean(),
		dokployValid: v.boolean(),
		errors: v.array(v.string()),
	}),
	handler: async (ctx, args) => {
		const errors: string[] = [];
		let hetznerValid = false;
		let dokployValid = false;

		// Validate Hetzner API key
		if (args.hetznerApiKey) {
			try {
				// TODO: Implement actual Hetzner API validation
				// For now, just check if it looks like a valid key format
				if (args.hetznerApiKey.length > 10) {
					hetznerValid = true;
				} else {
					errors.push("Invalid Hetzner API key format");
				}
			} catch (error) {
				errors.push("Failed to validate Hetzner API key");
			}
		}

		// Validate Dokploy API key
		if (args.dokployApiKey && args.dokployUrl) {
			try {
				// TODO: Implement actual Dokploy API validation
				// For now, just check basic format
				if (args.dokployApiKey.length > 10 && args.dokployUrl.startsWith("http")) {
					dokployValid = true;
				} else {
					errors.push("Invalid Dokploy API key or URL format");
				}
			} catch (error) {
				errors.push("Failed to validate Dokploy API key");
			}
		}

		return {
			hetznerValid,
			dokployValid,
			errors,
		};
	},
});

// Update validation status after API validation
export const updateValidationStatus = mutation({
	args: {
		isHetznerValid: v.boolean(),
		isDokployValid: v.boolean(),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		const user = await authComponent.getAuthUser(ctx);
		if (!user) {
			throw new Error("Not authenticated");
		}

		const apiKeys = await ctx.db
			.query("apiKeys")
			.withIndex("by_user", (q) => q.eq("userId", user.id))
			.unique();

		if (apiKeys) {
			await ctx.db.patch(apiKeys._id, {
				isHetznerValid: args.isHetznerValid,
				isDokployValid: args.isDokployValid,
				lastValidated: Date.now(),
			});
		}

		return null;
	},
});